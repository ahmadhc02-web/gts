const fs = require('fs');
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');
code = code.replace(
`    } catch (e) {
      console.error("PB: Fatal error getting billing months", e);
      return [];
    }
  },`,
`    } catch (e) {
      console.error("PB: Fatal error getting billing months", e);
      return [];
    }
  },`);
// Wait! Let me just add an extra bracket and test!
code = code.replace(
`    } catch (e) {
      console.error("PB: Fatal error getting billing months", e);
      return [];
    }
  },`,
`    } catch (e) {
      console.error("PB: Fatal error getting billing months", e);
      return [];
    }
  },`);
