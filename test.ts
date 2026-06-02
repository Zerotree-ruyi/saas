/**
 * 数据库测试脚本
 */

import {
  waitForDb,
  getAllAccounts,
  createAccount,
  createTransaction,
  createTransactionsBatch,
  getTransactionsPaged,
  getAccountSummary,
  getMonthlyStats,
  exportAllData,
  getCompany,
  searchAccounts,
  deleteAccount,
  closeDb
} from './db';

// 生成ID
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

async function test() {
  // 等待数据库初始化
  await waitForDb();

  console.log('========== 账王数据库测试 ==========\n');

  // 1. 测试获取所有账户
  console.log('1. 获取所有账户:');
  const accounts = await getAllAccounts();
  console.log(`   共 ${accounts.length} 个账户`);
  accounts.forEach(acc => {
    console.log(`   - ${acc.name} (${acc.type}): ${acc.balance} ${acc.currency}`);
  });

  // 2. 测试获取公司信息
  console.log('\n2. 获取公司信息:');
  const company = await getCompany();
  console.log(`   ${company?.name} | ${company?.code} | ${company?.status} | ${company?.mobile}`);

  // 3. 测试搜索账户
  console.log('\n3. 搜索账户（关键词"银行"）:');
  const searchResults = await searchAccounts('银行');
  searchResults.forEach(acc => {
    console.log(`   - ${acc.name} (${acc.type})`);
  });

  // 4. 测试创建自定义账户
  console.log('\n4. 创建自定义账户:');
  const newAccount = await createAccount({
    id: generateId('acc'),
    name: '测试账户',
    category: 'asset',
    type: '现金',
    balance: 1000,
    currency: 'CNY',
    remark: '测试用账户',
    isSystem: 0,
    disabled: 0
  });
  console.log(`   创建成功: ${newAccount.name} (ID: ${newAccount.id})`);

  // 5. 测试创建记账记录
  console.log('\n5. 创建收入记账:');
  const incomeResult = await createTransaction({
    id: generateId('trans'),
    accountId: newAccount.id,
    category: 'income',
    type: '销售收入',
    amount: 5000,
    currency: 'CNY',
    batchId: null,
    unitId: null,
    unitName: '',
    remark: '测试收入',
    date: new Date().toISOString().split('T')[0]
  });
  console.log(`   结果: ${incomeResult.success ? '成功' : '失败'} ${incomeResult.error || ''}`);

  // 6. 创建支出记账
  console.log('\n6. 创建支出记账:');
  const expenseResult = await createTransaction({
    id: generateId('trans'),
    accountId: newAccount.id,
    category: 'expense',
    type: '采购支出',
    amount: 2000,
    currency: 'CNY',
    batchId: null,
    unitId: null,
    unitName: '',
    remark: '测试支出',
    date: new Date().toISOString().split('T')[0]
  });
  console.log(`   结果: ${expenseResult.success ? '成功' : '失败'} ${expenseResult.error || ''}`);

  // 7. 批量创建记账
  console.log('\n7. 批量创建记账（5条）:');
  const batchTransactions = Array.from({ length: 5 }, (_, i) => ({
    id: generateId('trans'),
    accountId: 'acc_cash',
    category: 'expense' as const,
    type: '其他支出',
    amount: 100 * (i + 1),
    currency: 'CNY',
    batchId: null,
    unitId: null,
    unitName: '',
    remark: `批量支出${i + 1}`,
    date: new Date().toISOString().split('T')[0]
  }));
  const batchResult = await createTransactionsBatch(batchTransactions);
  console.log(`   结果: 成功 ${batchResult.count} 条, batchId: ${batchResult.batchId}`);

  // 8. 分页查询
  console.log('\n8. 分页查询记账记录:');
  const paged = await getTransactionsPaged({}, 1, 10);
  console.log(`   第${paged.page}页, 每页${paged.pageSize}条, 共${paged.total}条`);
  paged.data.forEach(trans => {
    console.log(`   - ${trans.date} | ${trans.category} | ${trans.amount} | ${trans.remark}`);
  });

  // 9. 账户汇总
  console.log('\n9. 账户资产汇总:');
  const summary = await getAccountSummary();
  console.log(`   资产合计: ${summary.totalAsset}`);
  console.log(`   负债合计: ${summary.totalLiability}`);
  console.log(`   权益合计: ${summary.totalEquity}`);
  console.log(`   净资产: ${summary.netAsset}`);

  // 10. 月度统计
  console.log('\n10. 本月统计:');
  const now = new Date();
  const monthly = await getMonthlyStats(now.getFullYear(), now.getMonth() + 1);
  console.log(`   收入: ${monthly.totalIncome}`);
  console.log(`   支出: ${monthly.totalExpense}`);
  console.log(`   利润: ${monthly.profit}`);

  // 11. 数据导出
  console.log('\n11. 数据导出:');
  const exportData = await exportAllData();
  console.log(`   版本: ${exportData.version}`);
  console.log(`   导出时间: ${exportData.exportedAt}`);
  console.log(`   账户: ${exportData.accounts.length} 条`);
  console.log(`   记账记录: ${exportData.transactions.length} 条`);
  console.log(`   往来单位: ${exportData.counterparties.length} 条`);

  // 12. 删除测试账户
  console.log('\n12. 删除测试账户:');
  const deleteResult = await deleteAccount(newAccount.id);
  console.log(`   结果: ${deleteResult ? '成功' : '系统账户无法删除'}`);

  console.log('\n========== 测试完成 ==========');
  closeDb();
}

test().catch(console.error);
