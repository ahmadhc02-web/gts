export interface Table1Row {
  sr: any;
  cId: string;
  name: string;
  comments: string;
  amount: number | string;
  ch: boolean;
  originalAmount?: number;
  clientId?: string;
  clientUsername?: string;
  status?: string;
}

export interface Table2Row {
  sr: any;
  name: string;
  amount: number | string;
  ch: boolean;
}
