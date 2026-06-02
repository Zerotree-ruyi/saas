/**
 * 账王 SaaS - API 服务器
 * 提供 RESTful API 给前端调用
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// 引入数据库模块
const db = require('../dist/db');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 托管静态文件 - 让前端通过 http://localhost:3000/ 访问
app.use(express.static(path.join(__dirname, '..')));

// 处理根路径 - 返回 HTML 文件
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '账王SaaS.html'));
});

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ==================== 健康检查 ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务正常运行' });
});

// ==================== 账户接口 ====================

app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await db.getAllAccounts();
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('获取账户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/accounts/:id', async (req, res) => {
  try {
    const account = await db.getAccountById(req.params.id);
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const account = await db.createAccount(req.body);
    res.json({ success: true, data: account });
  } catch (error) {
    console.error('创建账户失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const account = await db.updateAccount(req.params.id, req.body);
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const result = await db.deleteAccount(req.params.id);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/accounts/search/:keyword', async (req, res) => {
  try {
    const accounts = await db.searchAccounts(req.params.keyword);
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 记账记录接口 ====================

app.get('/api/transactions', async (req, res) => {
  try {
    const { page, pageSize, accountId, category, startDate, endDate } = req.query;

    if (page && pageSize) {
      const result = await db.getTransactionsPaged(
        { accountId, category, startDate, endDate },
        parseInt(page),
        parseInt(pageSize)
      );
      res.json({ success: true, ...result });
    } else {
      const transactions = await db.getAllTransactions();
      res.json({ success: true, data: transactions });
    }
  } catch (error) {
    console.error('获取记账记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await db.getTransactionById(req.params.id);
    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const data = req.body;
    if (!data.id) {
      data.id = 'trans_' + Date.now();
    }
    const result = await db.createTransaction(data);
    res.json(result);
  } catch (error) {
    console.error('创建记账记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transactions/batch', async (req, res) => {
  try {
    const result = await db.createTransactionsBatch(req.body);
    res.json(result);
  } catch (error) {
    console.error('批量创建记账记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const result = await db.deleteTransaction(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 往来单位接口 ====================

app.get('/api/counterparties', async (req, res) => {
  try {
    const { type } = req.query;
    const counterparties = type
      ? await db.getCounterpartiesByType(type)
      : await db.getAllCounterparties();
    res.json({ success: true, data: counterparties });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/counterparties', async (req, res) => {
  try {
    const counterparty = await db.createCounterparty(req.body);
    res.json({ success: true, data: counterparty });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/counterparties/:id', async (req, res) => {
  try {
    const counterparty = await db.updateCounterparty(req.params.id, req.body);
    res.json({ success: true, data: counterparty });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/counterparties/:id', async (req, res) => {
  try {
    await db.deleteCounterparty(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 公司信息接口 ====================

app.get('/api/company', async (req, res) => {
  try {
    const company = await db.getCompany();
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/company', async (req, res) => {
  try {
    const company = await db.updateCompany(req.body);
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 统计接口 ====================

app.get('/api/stats/summary', async (req, res) => {
  try {
    const summary = await db.getAccountSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    const stats = await db.getMonthlyStats(
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 导出/导入接口 ====================

app.get('/api/export', async (req, res) => {
  try {
    const data = await db.exportAllData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import', async (req, res) => {
  try {
    const result = await db.importData(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 启动服务器 ====================

async function startServer() {
  try {
    // 等待数据库初始化
    await db.waitForDb();
    console.log('数据库就绪');

    app.listen(PORT, () => {
      console.log(`账王 API 服务器已启动: http://localhost:${PORT}`);
      console.log(`API 文档: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
