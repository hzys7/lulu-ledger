// 璐璐记账 · 工具函数统一导出入口
// 使用时：import { formatMoney, loadAiConfig, getLocalVersion } from '../utils';
// 或：import * as Utils from '../utils';

// --- 货币
export {
  currencies,
  getCurrencySymbol,
  getCurrencyName,
  formatMoney,
  convertCurrency,
  getCurrencyList,
} from './currency';

// --- CSV 解析
export {
  parseCSVToTransactions,
  parseCSVLine,
  parseDateCell,
  parseAmountCell,
  detectColumns,
  detectType,
  parseNativeCSV,
  genTxId,
} from './csvParser';

// --- 导出 / 导入
export {
  exportTransactionsToCSV,
  exportToJSON,
  generateMonthlySummary,
  generateYearlySummary,
  parseImportText,
  pickImportFile,
} from './export';

// --- 存储
export {
  SCHEMA_VERSION,
  _resetStorageCache,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getBooks,
  addBook,
  updateBook,
  deleteBook,
  getCurrentBookId,
  setCurrentBookId,
  getBudgets,
  setBudget,
  deleteBudget,
  getSettings,
  updateSettings,
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  adjustAccountBalance,
  exportAllData,
  importData,
  importTransactionsFromCSV,
  clearAllData,
  getRecurring,
  addRecurring,
  deleteRecurring,
  processRecurring,
} from './storage';

// --- AI 配置
export {
  AI_PROVIDERS,
  DEFAULT_CONFIG,
  loadAiConfig,
  saveAiConfig,
  clearAiConfig,
  testAiConnection,
} from './aiConfig';

// --- AI 解析器
export {
  parseTransactionFromText,
} from './aiParser';

// --- AI 分类纠正
export {
  saveCorrection,
  getCorrections,
  clearCorrections,
  buildCorrectionExamples,
} from './aiCorrections';

// --- AI 解析器工具函数（纯 JS，可用于 Node 测试）
export {
  extractAllJsonObjects,
  validateParsed,
} from './aiParserUtils';

// --- AI 月度报告
export {
  getCachedReport,
  clearCachedReport,
  generateMonthlyReport,
} from './aiReport';

// --- AI 对话问答
export {
  askFinanceQuestion,
  buildFinancialContext,
} from './aiQA';

// --- AI 异常消费检测
export {
  detectAnomalies,
  generateAnomalyMessage,
  getCachedAnomalies,
  setCachedAnomalies,
  clearAnomalyCache,
} from './aiAnomaly';

// --- AI 预算建议
export {
  generateBudgetSuggestions,
} from './aiBudget';

// --- 周期性消费检测
export {
  detectRecurringPatterns,
  formatRecurringSuggestion,
} from './aiRecurring';

// --- 更新检查
export {
  compareVersion,
  getLocalVersion,
  fetchLatestRelease,
  checkForUpdate,
} from './updateChecker';
