/**
 * 账王 SaaS - 本地数据库模块
 * 使用 sql.js (SQLite in JavaScript) 实现本地数据持久化
 */

import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'cash360.db');

// 确保数据目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 数据库实例
let db: any;
let dbReady: Promise<void>;

// ==================== 类型定义 ====================

export interface Account {
  id: string;
  name: string;
  category: 'asset' | 'liability' | 'equity';
  type: string;
  balance: number;
  currency: string;
  remark: string;
  isSystem: number;
  disabled: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  batchId: string | null;
  accountId: string;
  category: 'income' | 'expense' | 'transfer';
  type: string;
  amount: number;
  currency: string;
  unitId: string | null;
  unitName: string;
  remark: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Counterparty {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  contact: string;
  phone: string;
  mobile: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  status: 'trial' | 'official';
  mobile: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: number;
  clientId: string;
  syncType: string;
  dataType: string;
  syncedAt: string;
}

// ==================== 数据库初始化 ====================

async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // 尝试加载已有数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  seedSystemData();
  saveToFile();
}

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0.00,
      currency TEXT DEFAULT 'CNY',
      remark TEXT DEFAULT '',
      isSystem INTEGER DEFAULT 0,
      disabled INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      batchId TEXT,
      accountId TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT DEFAULT '',
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'CNY',
      unitId TEXT,
      unitName TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      date TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS counterparties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      contact TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      mobile TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS company (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'trial',
      mobile TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId TEXT,
      syncType TEXT,
      dataType TEXT,
      syncedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // 创建索引
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(accountId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_batchId ON transactions(batchId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_disabled ON accounts(disabled)`);
  } catch (e) {
    // 索引可能已存在
  }
}

function seedSystemData(): void {
  const result = db.exec('SELECT COUNT(*) as count FROM accounts');
  const count = result.length > 0 ? result[0].values[0][0] : 0;
  if (count > 0) return;

  // 系统内置账户
  const systemAccounts = [
    ['acc_cash', '现金', 'asset', '现金', 0, 'CNY', '备用金、私人银行账户等', 1],
    ['acc_bank', '银行（对公）', 'asset', '银行', 0, 'CNY', '主要指对公户', 1],
    ['acc_alipay', '支付宝', 'asset', '支付宝', 0, 'CNY', '', 1],
    ['acc_wechat', '微信', 'asset', '微信', 0, 'CNY', '', 1],
    ['acc_receivable', '应收款', 'asset', '应收款', 0, 'CNY', '由[应收款]合并而成', 1],
    ['acc_advance_receivable', '预收款', 'asset', '预收款', 0, 'CNY', '预收客户款项', 1],
    ['acc_advance_payable', '预付款', 'asset', '预付款', 0, 'CNY', '预付供应商款项', 1],
    ['acc_inventory', '库存商品', 'asset', '库存商品', 0, 'CNY', '', 1],
    ['acc_fixed_asset', '固定资产', 'asset', '固定资产', 0, 'CNY', '', 1],
    ['acc_deferred_expense', '待摊费用', 'asset', '待摊费用', 0, 'CNY', '如房租、年费等', 1],
    ['acc_other_asset', '其他资产', 'asset', '其他资产', 0, 'CNY', '', 1],
    ['acc_payable', '应付款', 'liability', '应付款', 0, 'CNY', '', 1],
    ['acc_salary_payable', '应付工资', 'liability', '应付工资', 0, 'CNY', '已经计提，待发放的工资', 1],
    ['acc_other_liability', '其他负债', 'liability', '其他负债', 0, 'CNY', '', 1],
    ['acc_equity', '股本', 'equity', '实收资本', 0, 'CNY', '', 1],
    ['acc_profit', '利润', 'equity', '未分配利润', 0, 'CNY', '', 1],
  ];

  for (const acc of systemAccounts) {
    db.run(
      `INSERT INTO accounts (id, name, category, type, balance, currency, remark, isSystem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      acc
    );
  }

  db.run(
    `INSERT OR REPLACE INTO company (id, name, code, status, mobile) VALUES (?, ?, ?, ?, ?)`,
    ['company_1', '1231', 'ZW3992', 'trial', '16655533992']
  );

  saveToFile();
  console.log('系统数据初始化完成');
}

function saveToFile(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryAll<T>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

function queryOne<T>(sql: string, params: any[] = []): T | undefined {
  const results = queryAll<T>(sql, params);
  return results.length > 0 ? results[0] : undefined;
}

function runSql(sql: string, params: any[] = []): void {
  db.run(sql, params);
  saveToFile();
}

// ==================== 账户操作 ====================

export function getAllAccounts(): Promise<Account[]> {
  return Promise.resolve(queryAll<Account>('SELECT * FROM accounts ORDER BY createdAt'));
}

export function getAccountsByType(type: string): Promise<Account[]> {
  return Promise.resolve(queryAll<Account>('SELECT * FROM accounts WHERE type = ? AND disabled = 0', [type]));
}

export function getActiveAccounts(): Promise<Account[]> {
  return Promise.resolve(queryAll<Account>('SELECT * FROM accounts WHERE disabled = 0 ORDER BY createdAt'));
}

export function getAccountById(id: string): Promise<Account | undefined> {
  return Promise.resolve(queryOne<Account>('SELECT * FROM accounts WHERE id = ?', [id]));
}

export async function createAccount(account: Omit<Account, 'createdAt' | 'updatedAt'>): Promise<Account> {
  const now = new Date().toISOString();
  const id = account.id || 'acc_' + Date.now();
  runSql(
    `INSERT INTO accounts (id, name, category, type, balance, currency, remark, isSystem, disabled, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, account.name, account.category, account.type, account.balance,
      account.currency || 'CNY', account.remark || '', account.isSystem || 0, account.disabled || 0,
      now, now
    ]
  );
  saveToFile();
  const result = await getAccountById(id);
  return result!;
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<Account | undefined> {
  const account = await getAccountById(id);
  if (!account) return undefined;

  const now = new Date().toISOString();
  runSql(
    `UPDATE accounts SET name = ?, balance = ?, remark = ?, disabled = ?, updatedAt = ? WHERE id = ?`,
    [data.name ?? account.name, data.balance ?? account.balance, data.remark ?? account.remark,
     data.disabled ?? account.disabled, now, id]
  );
  saveToFile();
  return getAccountById(id);
}

export async function deleteAccount(id: string): Promise<boolean> {
  const account = await getAccountById(id);
  if (!account) return false;
  if (account.isSystem) return false;
  runSql('DELETE FROM accounts WHERE id = ? AND isSystem = 0', [id]);
  saveToFile();
  return true;
}

export function enableAccount(id: string): Promise<void> {
  runSql('UPDATE accounts SET disabled = 0, updatedAt = ? WHERE id = ?', [new Date().toISOString(), id]);
  saveToFile();
  return Promise.resolve();
}

export function disableAccount(id: string): Promise<void> {
  runSql('UPDATE accounts SET disabled = 1, updatedAt = ? WHERE id = ?', [new Date().toISOString(), id]);
  saveToFile();
  return Promise.resolve();
}

export function searchAccounts(keyword: string): Promise<Account[]> {
  const pattern = `%${keyword}%`;
  return Promise.resolve(queryAll<Account>(
    'SELECT * FROM accounts WHERE (name LIKE ? OR remark LIKE ?) AND disabled = 0 ORDER BY createdAt',
    [pattern, pattern]
  ));
}

export async function updateAccountBalance(accountId: string, amount: number, type: 'add' | 'subtract'): Promise<void> {
  const account = await getAccountById(accountId);
  if (!account) return;
  const newBalance = type === 'add' ? account.balance + amount : account.balance - amount;
  runSql('UPDATE accounts SET balance = ?, updatedAt = ? WHERE id = ?', [newBalance, new Date().toISOString(), accountId]);
}

// ==================== 记账记录操作 ====================

export function getAllTransactions(limit?: number, offset?: number): Promise<Transaction[]> {
  let sql = 'SELECT * FROM transactions ORDER BY date DESC, createdAt DESC';
  if (limit !== undefined) {
    sql += ` LIMIT ${limit} OFFSET ${offset || 0}`;
  }
  return Promise.resolve(queryAll<Transaction>(sql));
}

export function getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
  return Promise.resolve(queryAll<Transaction>(
    'SELECT * FROM transactions WHERE accountId = ? ORDER BY date DESC', [accountId]
  ));
}

export function getTransactionsByCategory(category: string): Promise<Transaction[]> {
  return Promise.resolve(queryAll<Transaction>(
    'SELECT * FROM transactions WHERE category = ? ORDER BY date DESC', [category]
  ));
}

export function getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
  return Promise.resolve(queryAll<Transaction>(
    'SELECT * FROM transactions WHERE date >= ? AND date <= ? ORDER BY date DESC',
    [startDate, endDate]
  ));
}

export function getTransactionsByBatchId(batchId: string): Promise<Transaction[]> {
  return Promise.resolve(queryAll<Transaction>(
    'SELECT * FROM transactions WHERE batchId = ? ORDER BY createdAt', [batchId]
  ));
}

export function getTransactionById(id: string): Promise<Transaction | undefined> {
  return Promise.resolve(queryOne<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]));
}

export async function createTransaction(
  trans: Omit<Transaction, 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
  try {
    const now = new Date().toISOString();
    runSql(
      `INSERT INTO transactions (id, batchId, accountId, category, type, amount, currency, unitId, unitName, remark, date, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trans.id, trans.batchId || null, trans.accountId, trans.category, trans.type || '',
       trans.amount, trans.currency || 'CNY', trans.unitId || null, trans.unitName || '',
       trans.remark || '', trans.date, now, now]
    );

    if (trans.category === 'income') {
      updateAccountBalance(trans.accountId, trans.amount, 'add');
    } else if (trans.category === 'expense') {
      updateAccountBalance(trans.accountId, trans.amount, 'subtract');
    }

    const transaction = await getTransactionById(trans.id);
    return { success: true, transaction };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createTransactionsBatch(
  transactions: Array<Omit<Transaction, 'createdAt' | 'updatedAt'>>
): Promise<{ success: boolean; count: number; batchId: string; error?: string }> {
  try {
    const batchId = 'batch_' + Date.now();
    const now = new Date().toISOString();

    for (const trans of transactions) {
      runSql(
        `INSERT INTO transactions (id, batchId, accountId, category, type, amount, currency, unitId, unitName, remark, date, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [trans.id || `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, batchId,
         trans.accountId, trans.category, trans.type || '', trans.amount, trans.currency || 'CNY',
         trans.unitId || null, trans.unitName || '', trans.remark || '', trans.date, now, now]
      );

      if (trans.category === 'income') {
        updateAccountBalance(trans.accountId, trans.amount, 'add');
      } else if (trans.category === 'expense') {
        updateAccountBalance(trans.accountId, trans.amount, 'subtract');
      }
    }

    return { success: true, count: transactions.length, batchId };
  } catch (error: any) {
    return { success: false, count: 0, batchId: '', error: error.message };
  }
}

export async function deleteTransaction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const trans = await getTransactionById(id);
    if (!trans) return { success: false, error: '记录不存在' };

    if (trans.category === 'income') {
      updateAccountBalance(trans.accountId, trans.amount, 'subtract');
    } else if (trans.category === 'expense') {
      updateAccountBalance(trans.accountId, trans.amount, 'add');
    }

    runSql('DELETE FROM transactions WHERE id = ?', [id]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function getTransactionsPaged(
  filters: { accountId?: string; category?: string; startDate?: string; endDate?: string },
  page: number = 1,
  pageSize: number = 20
): Promise<{ data: Transaction[]; total: number; page: number; pageSize: number }> {
  let whereClause = '1=1';
  const params: any[] = [];

  if (filters.accountId) { whereClause += ' AND accountId = ?'; params.push(filters.accountId); }
  if (filters.category) { whereClause += ' AND category = ?'; params.push(filters.category); }
  if (filters.startDate) { whereClause += ' AND date >= ?'; params.push(filters.startDate); }
  if (filters.endDate) { whereClause += ' AND date <= ?'; params.push(filters.endDate); }

  const countResult = queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM transactions WHERE ${whereClause}`, params);
  const total = countResult?.total || 0;
  const offset = (page - 1) * pageSize;
  const data = queryAll<Transaction>(
    `SELECT * FROM transactions WHERE ${whereClause} ORDER BY date DESC, createdAt DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return Promise.resolve({ data, total, page, pageSize });
}

// ==================== 往来单位操作 ====================

export function getAllCounterparties(): Promise<Counterparty[]> {
  return Promise.resolve(queryAll<Counterparty>('SELECT * FROM counterparties ORDER BY createdAt DESC'));
}

export function getCounterpartiesByType(type: 'customer' | 'supplier'): Promise<Counterparty[]> {
  return Promise.resolve(queryAll<Counterparty>(
    'SELECT * FROM counterparties WHERE type = ? ORDER BY createdAt DESC', [type]
  ));
}

export function getCounterpartyById(id: string): Promise<Counterparty | undefined> {
  return Promise.resolve(queryOne<Counterparty>('SELECT * FROM counterparties WHERE id = ?', [id]));
}

export async function createCounterparty(counterparty: Omit<Counterparty, 'createdAt' | 'updatedAt'>): Promise<Counterparty> {
  const now = new Date().toISOString();
  runSql(
    `INSERT INTO counterparties (id, name, type, contact, phone, mobile, remark, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [counterparty.id, counterparty.name, counterparty.type, counterparty.contact || '',
     counterparty.phone || '', counterparty.mobile || '', counterparty.remark || '', now, now]
  );
  const result = await getCounterpartyById(counterparty.id);
  return result!;
}

export async function updateCounterparty(id: string, data: Partial<Counterparty>): Promise<Counterparty | undefined> {
  const counterparty = await getCounterpartyById(id);
  if (!counterparty) return undefined;

  const now = new Date().toISOString();
  runSql(
    `UPDATE counterparties SET name = ?, type = ?, contact = ?, phone = ?, mobile = ?, remark = ?, updatedAt = ? WHERE id = ?`,
    [data.name ?? counterparty.name, data.type ?? counterparty.type, data.contact ?? counterparty.contact,
     data.phone ?? counterparty.phone, data.mobile ?? counterparty.mobile, data.remark ?? counterparty.remark, now, id]
  );
  return getCounterpartyById(id);
}

export function deleteCounterparty(id: string): Promise<void> {
  runSql('DELETE FROM counterparties WHERE id = ?', [id]);
  return Promise.resolve();
}

// ==================== 公司信息操作 ====================

export function getCompany(): Promise<Company | undefined> {
  return Promise.resolve(queryOne<Company>('SELECT * FROM company LIMIT 1'));
}

export async function updateCompany(data: Partial<Company>): Promise<Company | undefined> {
  const company = await getCompany();
  if (!company) return undefined;

  const now = new Date().toISOString();
  runSql(
    `UPDATE company SET name = ?, status = ?, mobile = ?, updatedAt = ? WHERE id = ?`,
    [data.name ?? company.name, data.status ?? company.status, data.mobile ?? company.mobile, now, company.id]
  );
  return getCompany();
}

// ==================== 数据导出/导入 ====================

export interface ExportData {
  version: string;
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  counterparties: Counterparty[];
  company: Company | undefined;
}

export function exportAllData(): Promise<ExportData> {
  const accounts = queryAll<Account>('SELECT * FROM accounts');
  const transactions = queryAll<Transaction>('SELECT * FROM transactions');
  const counterparties = queryAll<Counterparty>('SELECT * FROM counterparties');
  const company = queryOne<Company>('SELECT * FROM company LIMIT 1');

  return Promise.resolve({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    accounts, transactions, counterparties, company
  });
}

export async function importData(data: ExportData): Promise<{ success: boolean; error?: string }> {
  try {
    db.run('DELETE FROM transactions');
    db.run('DELETE FROM counterparties');
    db.run('DELETE FROM accounts WHERE isSystem = 0');

    for (const acc of data.accounts) {
      runSql(
        `INSERT INTO accounts (id, name, category, type, balance, currency, remark, isSystem, disabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [acc.id, acc.name, acc.category, acc.type, acc.balance, acc.currency, acc.remark,
         acc.isSystem, acc.disabled, acc.createdAt, acc.updatedAt]
      );
    }

    for (const trans of data.transactions) {
      runSql(
        `INSERT INTO transactions (id, batchId, accountId, category, type, amount, currency, unitId, unitName, remark, date, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [trans.id, trans.batchId, trans.accountId, trans.category, trans.type, trans.amount,
         trans.currency, trans.unitId, trans.unitName, trans.remark, trans.date, trans.createdAt, trans.updatedAt]
      );
    }

    for (const cp of data.counterparties) {
      runSql(
        `INSERT INTO counterparties (id, name, type, contact, phone, mobile, remark, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cp.id, cp.name, cp.type, cp.contact, cp.phone, cp.mobile, cp.remark, cp.createdAt, cp.updatedAt]
      );
    }

    if (data.company) {
      runSql(
        `INSERT OR REPLACE INTO company (id, name, code, status, mobile, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.company.id, data.company.name, data.company.code, data.company.status,
         data.company.mobile, data.company.createdAt, data.company.updatedAt]
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function exportToJsonFile(filePath: string): Promise<void> {
  return exportAllData().then(data => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  });
}

export function importFromJsonFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as ExportData;
    return importData(data);
  } catch (error: any) {
    return Promise.resolve({ success: false, error: error.message });
  }
}

// ==================== 同步日志 ====================

export function addSyncLog(clientId: string, syncType: 'upload' | 'download', dataType: string): Promise<void> {
  runSql(`INSERT INTO sync_log (clientId, syncType, dataType) VALUES (?, ?, ?)`, [clientId, syncType, dataType]);
  return Promise.resolve();
}

export function getLastSyncLog(): Promise<SyncLog | undefined> {
  return Promise.resolve(queryOne<SyncLog>('SELECT * FROM sync_log ORDER BY syncedAt DESC LIMIT 1'));
}

// ==================== 统计查询 ====================

export function getAccountSummary(): Promise<{ totalAsset: number; totalLiability: number; totalEquity: number; netAsset: number }> {
  const asset = queryOne<{ total: number }>('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE category = "asset" AND disabled = 0');
  const liability = queryOne<{ total: number }>('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE category = "liability" AND disabled = 0');
  const equity = queryOne<{ total: number }>('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE category = "equity" AND disabled = 0');

  return Promise.resolve({
    totalAsset: asset?.total || 0,
    totalLiability: liability?.total || 0,
    totalEquity: equity?.total || 0,
    netAsset: (asset?.total || 0) - (liability?.total || 0)
  });
}

export function getMonthlyStats(year: number, month: number): Promise<{ totalIncome: number; totalExpense: number; profit: number }> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const income = queryOne<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE category = "income" AND date >= ? AND date <= ?',
    [startDate, endDate]
  );
  const expense = queryOne<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE category = "expense" AND date >= ? AND date <= ?',
    [startDate, endDate]
  );

  return Promise.resolve({
    totalIncome: income?.total || 0,
    totalExpense: expense?.total || 0,
    profit: (income?.total || 0) - (expense?.total || 0)
  });
}

// ==================== 初始化 ====================

dbReady = initDatabase();

export async function waitForDb(): Promise<void> {
  await dbReady;
}

export function getDb(): any {
  return db;
}

export function closeDb(): void {
  if (db) {
    saveToFile();
    db.close();
  }
}

export default {
  waitForDb,
  getAllAccounts, getAccountsByType, getActiveAccounts, getAccountById, createAccount,
  updateAccount, deleteAccount, enableAccount, disableAccount, searchAccounts, updateAccountBalance,
  getAllTransactions, getTransactionsByAccount, getTransactionsByCategory, getTransactionsByDateRange,
  getTransactionsByBatchId, getTransactionById, createTransaction, createTransactionsBatch,
  deleteTransaction, getTransactionsPaged,
  getAllCounterparties, getCounterpartiesByType, getCounterpartyById, createCounterparty,
  updateCounterparty, deleteCounterparty,
  getCompany, updateCompany,
  exportAllData, importData, exportToJsonFile, importFromJsonFile,
  addSyncLog, getLastSyncLog,
  getAccountSummary, getMonthlyStats,
  getDb, closeDb
};
