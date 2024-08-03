
import getType from "./types.js";
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import * as arrow from "apache-arrow";

async function makeDB() {
  const MANUAL_BUNDLES = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
    },
  };
  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  console.log("DB initialized");

  const conn = await db.connect();
  await conn.query(`
      INSTALL parquet; LOAD parquet;
    `);
    
    await conn.query(`
      INSTALL spatial;
      LOAD spatial;
  `);
  await conn.close();
  console.log("Extension initialized");
  return db;
}

// Latest duckdb client from : https://observablehq.com/@kimmolinna/duckdb-latest/2
class DuckDBClient {
  constructor(_db) {
    this._db = _db;
    this._counter = 0;
  }

  async queryStream(query, params) {
    const conn = await this.connection();
    let result;

    if (params) {
      const stmt = await conn.prepare(query);
      result = await stmt.query(...params);
    } else {
      result = await conn.query(query);
    }
    // Populate the schema of the results
    const schema = result.schema.fields.map(({ name, type }) => ({
      name,
      type: getType(String(type)),
      databaseType: String(type)
    }));
    return {
      schema,
      async *readRows() {
        let rows = result.toArray().map((r) => Object.fromEntries(r));
        yield rows;
      }
    };
  }

  // This function gets called to prepare the `query` parameter of the `queryStream` method
  queryTag(strings, ...params) {
    return [strings.join("?"), params];
  }

  escape(name) {
    return `"${name}"`;
  }

  async describeTables() {
    const conn = await this.connection();
    const tables = (await conn.query(`SHOW TABLES`)).toArray();
    return tables.map(({ name }) => ({ name }));
  }

  async describeColumns({ table } = {}) {
    const conn = await this.connection();
    const columns = (await conn.query(`DESCRIBE ${table}`)).toArray();
    return columns.map(({ column_name, column_type }) => {
      return {
        name: column_name,
        type: getType(column_type),
        databaseType: column_type
      };
    });
  }

  async db() {
    if (!this._db) {
      this._db = await makeDB();
      await this._db.open({
        query: {
          castTimestampToDate: true
        }
      });
    }
    return this._db;
  }

  async connection() {
    if (!this._conn) {
      const db = await this.db();
      this._conn = await db.connect();
    }
    return this._conn;
  }

  async reconnect() {
    if (this._conn) {
      this._conn.close();
    }
    delete this._conn;
  }

  // The `.queryStream` function will supercede this for SQL and Table cells
  // Keeping this for backwards compatibility
  async query(query, params) {
    const key = `Query ${this._counter++}: ${query}`;
    console.time(key);
    const conn = await this.connection();
    let result;

    if (params) {
      const stmt = await conn.prepare(query);
      result = stmt.query(...params);
    } else {
      result = await conn.query(query);
    }

    console.timeEnd(key);
    return result;
  }

  // The `.queryStream` function will supercede this for SQL and Table cells
  // Keeping this for backwards compatibility
  async sql(strings, ...args) {
    // expected to be used like db.sql`select * from table where foo = ${param}`

    // let queryWithParams = strings.join("?");
    // if (typeof args !== 'undefined'){
    //   for (const param of args) {
    //     queryWithParams = queryWithParams.replace('?', param);
    //   }
    // }
    // const results = await this.query(queryWithParams);

    const results = await this.query(strings.join("?"), args);

    // return rows as a JavaScript array of objects for now
    let rows = results.toArray().map(Object.fromEntries);
    rows.columns = results.schema.fields.map((d) => d.name);
    return rows;
  }

  async table(query, params, opts) {
    const result = await this.query(query, params);
    return Inputs.table(result, { layout: "auto", ...(opts || {}) });
  }

  // get the client after the query ran
  async client(query, params) {
    await this.query(query, params);
    return this;
  }

  // query a single row
  async queryRow(query, params) {
    const key = `Query ${this._counter++}: ${query}`;

    console.time(key);
    const conn = await this.connection();
    // use send as we can stop iterating after we get the first batch
    const result = await conn.send(query, params);
    const batch = (await result.next()).value;
    console.timeEnd(key);

    return batch?.get(0);
  }

  async explain(query, params) {
    const row = await this.queryRow(`EXPLAIN ${query}`, params);
    return element("pre", { className: "observablehq--inspect" }, [
      text(row["explain_value"])
    ]);
  }

  // Describe the database (no arg) or a table
  async describe(object) {
    const result = await (object === undefined
      ? this.query(`SHOW TABLES`)
      : this.query(`DESCRIBE ${object}`));
    return Inputs.table(result);
  }

  // Summarize a query result
  async summarize(query) {
    const result = await this.query(`SUMMARIZE ${query}`);
    return Inputs.table(result);
  }

  async insertJSON(name, buffer, options) {
    const db = await this.db();
    await db.registerFileBuffer(name, new Uint8Array(buffer));
    const conn = await db.connect();
    await conn.insertJSONFromPath(name, { name, schema: "main", ...options });
    await conn.close();

    return this;
  }

  async insertCSV(name, options) {
    const db = await this.db();
    const conn = await db.connect();
    await conn.insertCSVFromPath(name.url, { ...options });
    await conn.close();

    return this;
  }

  async insertParquet(name) {
    // const res = await fetch(`./${name}`);
    // const buffer = await res.arrayBuffer();

    const db = await this.db();

    // await db.registerFileBuffer(name, new Uint8Array(buffer));
    await db.registerFileURL(
      name.file,
      name.url,
      duckdb.DuckDBDataProtocol.HTTP,
      false,
    );
    const conn = await db.connect();
    await conn.query(
      `CREATE VIEW IF NOT EXISTS '${name.file}' AS SELECT * FROM parquet_scan('${name.file}')`,
    );
    await conn.close();

    return this;
  }

  async insertArrowTable(name, table, options) {
    const buffer = arrow.tableToIPC(table);
    return this.insertArrowFromIPCStream(name, buffer, {name});
  }

  async insertArrowFromIPCStream(name, buffer, options) {
    const db = await this.db();
    const conn = await db.connect();
        
    await conn.insertArrowFromIPCStream(buffer, {
      name,
      schema: 'main',
      ...options
    });
    await conn.close();
    
    return this;
  }

  // Create a database from FileArrachments
  static async of(files = []) {
    const db = await makeDB();
    await db.open({
      query: {
        castTimestampToDate: true
      }
    });

    const toName = (file) =>
      file.name.split(".").slice(0, -1).join(".").replace(/\@.+?/, ""); // remove the "@X" versions Observable adds to file names

    if (files.constructor.name === "FileAttachment") {
      files = [[toName(files), files]];
    } else if (!Array.isArray(files)) {
      files = Object.entries(files);
    }

    // Add all files to the database. Import JSON and CSV. Create view for Parquet.
    await Promise.all(
      files.map(async (file) => {
        // let file;
        let name;
        let options = {};
        

        // if (Array.isArray(entry)) {
        //   [name, file] = entry;
        //   if (file.hasOwnProperty("file")) {
        //     ({ file, ...options } = file);
        //   }
        // } else if (entry.constructor.name === "FileAttachment") {
        //   [name, file] = [toName(entry), entry];
        // } else if (typeof entry === "object") {
        //   ({ file, name, ...options } = entry);
        //   name = name ?? toName(file);
        // } else {
        //   console.error("Unrecognized entry", entry);
        // }

        // if (!file.url && Array.isArray(file)) {
        //   const data = file;
        //   // file = { name: name + ".json" };
        //   // db.registerFileText(`${name}.json`, JSON.stringify(data));

        //   const table = arrow.tableFromJSON(data);
        //   const buffer = arrow.tableToIPC(table);

        //   const conn = await db.connect();
        //   await conn.insertArrowFromIPCStream(buffer, {
        //     name,
        //     schema: "main",
        //     ...options
        //   });
        //   await conn.close();
        //   return;
        // } else {
          // const url = await file.url();
          // if (url.indexOf("blob:") === 0) {
          //   const buffer = await file.arrayBuffer();
          //   await db.registerFileBuffer(file.name, new Uint8Array(buffer));
          // } else {
          //   await db.registerFileURL(file.name, url);
          // }
        // }
        console.log(file);
        const conn = await db.connect();
        if (file.url.endsWith(".csv")) {
          await conn.insertCSVFromPath(file.url, {
            name: file.name,
            schema: "main",
            ...options
          });
        } else if (file.url.endsWith(".json")) {
          await conn.insertJSONFromPath(file.url, {
            name: file.name,
            schema: "main",
            ...options
          });
        } else if (file.url.endsWith(".parquet")) {

          await db.registerFileURL(
            file.name,
            file.url,
            duckdb.DuckDBDataProtocol.HTTP,
            false,
          );
          const conn = await db.connect();
          await conn.query(`
            INSTALL spatial;
            LOAD spatial;
        `);
          await conn.query(
            `CREATE VIEW '${file.name}' AS SELECT * FROM parquet_scan('${file.url}')`
          );
        } else {
          console.warn(`Don't know how to handle file type of ${file.name}`);
        }
        await conn.close();
      })
    );

    return new DuckDBClient(db);
  }
}

export { makeDB, DuckDBClient };
