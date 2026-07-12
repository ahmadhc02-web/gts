import { auth, getDb } from './src/lib/firebase';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit as fLimit, writeBatch } from 'firebase/firestore';

export const supabase = {
  from: (tableName: string) => {
    return new QueryBuilder(tableName);
  },
  channel: (channelId: string) => {
    return {
      on: (event: any, config: any, callback: any) => {
        return {
          subscribe: () => {}
        };
      },
      subscribe: async (cb: any) => {
         if (cb) cb('SUBSCRIBED');
      },
      send: async (payload?: any) => {}
    };
  },
  removeChannel: (channel: any) => {}
};

class QueryBuilder {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null;
  private selectFields: string = '*';
  private conditions: any[] = [];
  private orderRules: any[] = [];
  private limitCount: number | null = null;
  private payload: any = null;
  private isSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields = '*') {
    this.action = 'select';
    this.selectFields = fields;
    return this;
  }

  insert(payload: any) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(payload: any, options?: any) {
    this.action = 'upsert';
    this.payload = payload;
    return this;
  }

  eq(column: string, value: any) {
    this.conditions.push({ type: 'eq', column, value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.conditions.push({ type: 'not', column, operator, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.conditions.push({ type: 'in', column, values });
    return this;
  }
  
  like(column: string, pattern: string) {
    this.conditions.push({ type: 'like', column, pattern });
    return this;
  }
  
  lt(column: string, value: any) {
    this.conditions.push({ type: 'lt', column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderRules.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then(resolve: (value: any) => void, reject: (reason?: any) => void) {
    try {
      const db = getDb();
      const colRef = collection(db, this.tableName);

      if (this.action === 'select') {
        let q: any = colRef;
        // In Firestore, we can't easily chain multiple complex inequality filters or like.
        // We'll apply basic ones to Firestore, and the rest via JS array filtering.
        const firestoreConditions = [];
        const jsConditions = [];

        for (const cond of this.conditions) {
          if (cond.type === 'eq') {
            q = query(q, where(cond.column, '==', cond.value));
          } else if (cond.type === 'in') {
             if (cond.values.length > 0) {
               q = query(q, where(cond.column, 'in', cond.values.slice(0, 10))); // FB limits to 10
               if (cond.values.length > 10) {
                  jsConditions.push(cond);
               }
             } else {
               return resolve({ data: [], error: null });
             }
          } else {
            jsConditions.push(cond);
          }
        }
        
        // Disable order/limit in query if we have JS conditions because we'll have to do it post-fetch
        if (jsConditions.length === 0) {
          for (const rule of this.orderRules) {
            q = query(q, orderBy(rule.column, rule.ascending ? 'asc' : 'desc'));
          }
          if (this.limitCount !== null) {
            q = query(q, fLimit(this.limitCount));
          }
        }

        const snapshot = await getDocs(q);
        let data = snapshot.docs.map(d => ({ ...(d.data() as object), _docId: d.id }));

        // Apply JS conditions
        if (jsConditions.length > 0) {
           data = data.filter((item: any) => {
              for (const cond of jsConditions) {
                 if (cond.type === 'not') {
                    if (cond.operator === 'is' && cond.value === null) {
                       if (item[cond.column] === null) return false;
                    } else if (item[cond.column] === cond.value) {
                       return false;
                    }
                 } else if (cond.type === 'like') {
                    const pattern = cond.pattern.replace(/%/g, '.*');
                    const regex = new RegExp(`^${pattern}$`, 'i');
                    if (!regex.test(item[cond.column])) return false;
                 } else if (cond.type === 'lt') {
                    if (!(item[cond.column] < cond.value)) return false;
                 } else if (cond.type === 'in') {
                    if (!cond.values.includes(item[cond.column])) return false;
                 }
              }
              return true;
           });

           // Apply JS order
           for (const rule of this.orderRules) {
             data.sort((a: any, b: any) => {
                const av = a[rule.column];
                const bv = b[rule.column];
                if (av < bv) return rule.ascending ? -1 : 1;
                if (av > bv) return rule.ascending ? 1 : -1;
                return 0;
             });
           }

           // Apply JS limit
           if (this.limitCount !== null) {
             data = data.slice(0, this.limitCount);
           }
        }

        if (this.isSingle) {
           return resolve({ data: data.length > 0 ? data[0] : null, error: null });
        }
        return resolve({ data, error: null });
      }

      if (this.action === 'insert') {
        const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
        const batch = writeBatch(db);
        for (const item of arr) {
          const docId = item.id || item.uid || doc(colRef).id;
          if (!item.id && this.tableName !== 'users') item.id = docId;
          const dRef = doc(colRef, String(docId));
          batch.set(dRef, item);
        }
        await batch.commit();
        return resolve({ data: arr, error: null });
      }

      if (this.action === 'update' || this.action === 'delete') {
        let q: any = colRef;
        for (const cond of this.conditions) {
           if (cond.type === 'eq') {
             q = query(q, where(cond.column, '==', cond.value));
           } else if (cond.type === 'not') {
             q = query(q, where(cond.column, '!=', cond.value));
           } else if (cond.type === 'in') {
             if (cond.values.length > 0) {
               q = query(q, where(cond.column, 'in', cond.values.slice(0, 10)));
             } else {
               return resolve({ data: null, error: null });
             }
           }
        }
        
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        snapshot.docs.forEach(dSnap => {
          const dRef = doc(colRef, dSnap.id);
          if (this.action === 'update') {
            batch.update(dRef, this.payload);
          } else {
            batch.delete(dRef);
          }
        });
        await batch.commit();
        return resolve({ data: null, error: null });
      }

      if (this.action === 'upsert') {
        const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
        const batch = writeBatch(db);
        for (const item of arr) {
          const docId = item.id || item.uid || item.config_type || doc(colRef).id;
          const dRef = doc(colRef, String(docId));
          batch.set(dRef, item, { merge: true });
        }
        await batch.commit();
        return resolve({ data: arr, error: null });
      }

    } catch (err: any) {
      return resolve({ data: null, error: { message: err.message } });
    }
  }
}
