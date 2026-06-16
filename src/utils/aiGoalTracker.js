// 璐璐记账 · AI 消费目标追踪
// 存储用户设定的消费目标，AI 分析进度并给出建议
import { callAiApi } from './aiClient';
import { getCache, setCache } from './aiCache';

const GOAL_STORAGE_KEY = 'lulu_spending_goals';

const GOAL_SYSTEM_PROMPT = `你是一名个人理财教练，名字叫"小璐"。请根据用户的消费目标和当前进度，给出鼓励和建议。

输出要求：
- 仅输出纯文本，不要 Markdown 格式
- 不要任何前缀说明
- 控制在 120 字以内
- 用中文，语气积极鼓励
- 可以使用 emoji

分析重点：
1. 当前进度（已花/目标/剩余天数）
2. 按当前速度能否达标
3. 一句具体建议

注意：
- 如果进度良好，要给予肯定
- 如果可能超支，温和提醒但不要制造焦虑
- 建议要具体可执行`;

/**
 * 获取所有消费目标
 */
export async function getGoals() {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const raw = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 添加消费目标
 * @param {Object} goal
 * @param {string} goal.name - 目标名称（如"本月餐饮"）
 * @param {string} goal.category - 关联分类（可选，null 表示总支出）
 * @param {number} goal.amount - 目标金额
 * @param {string} goal.period - 'month' | 'week'
 */
export async function addGoal(goal) {
  const goals = await getGoals();
  const newGoal = {
    id: `goal_${Date.now()}`,
    name: goal.name,
    category: goal.category || null,
    amount: goal.amount,
    period: goal.period || 'month',
    createdAt: new Date().toISOString(),
    active: true,
  };
  goals.push(newGoal);
  await saveGoals(goals);
  return newGoal;
}

/**
 * 删除消费目标
 */
export async function removeGoal(goalId) {
  const goals = await getGoals();
  const filtered = goals.filter(g => g.id !== goalId);
  await saveGoals(filtered);
  return filtered;
}

/**
 * 更新消费目标
 */
export async function updateGoal(goalId, updates) {
  const goals = await getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx >= 0) {
    goals[idx] = { ...goals[idx], ...updates };
    await saveGoals(goals);
  }
  return goals;
}

async function saveGoals(goals) {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goals));
  } catch {}
}

/**
 * 获取目标进度
 * @param {Object} goal - 目标对象
 * @param {Array} transactions - 交易记录
 * @returns {Object} { spent, remaining, percent, daysLeft, onTrack }
 */
export function getGoalProgress(goal, transactions) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 筛选相关交易
  let filtered = transactions.filter(t => {
    const d = new Date(t.date);
    const isCurrentPeriod = goal.period === 'week'
      ? isSameWeek(d, now)
      : d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    return isCurrentPeriod && t.type === 'expense';
  });

  if (goal.category) {
    filtered = filtered.filter(t => t.category === goal.category);
  }

  const spent = filtered.reduce((s, t) => s + t.amount, 0);
  const remaining = goal.amount - spent;
  const percent = goal.amount > 0 ? Math.min(100, (spent / goal.amount) * 100) : 0;

  // 计算剩余天数
  const daysInPeriod = goal.period === 'week' ? 7 : daysInMonth(currentYear, currentMonth);
  const dayOfMonth = now.getDate();
  const daysLeft = goal.period === 'week'
    ? 7 - now.getDay()
    : daysInPeriod - dayOfMonth;

  // 判断是否在轨道上
  const elapsed = goal.period === 'week' ? now.getDay() : dayOfMonth;
  const expectedPercent = elapsed / daysInPeriod * 100;
  const onTrack = percent <= expectedPercent + 10; // 允许 10% 余量

  return {
    spent,
    remaining,
    percent: Math.round(percent),
    daysLeft,
    onTrack,
    dailyAvg: elapsed > 0 ? spent / elapsed : 0,
    dailyBudget: daysLeft > 0 ? remaining / daysLeft : 0,
  };
}

/**
 * AI 生成目标追踪建议
 */
export async function generateGoalAdvice(goal, progress) {
  const goalCacheKey = `goal_advice_${goal.id}`;
  const cached = await getCache(goalCacheKey);
  if (cached && cached.content) {
    return { ok: true, content: cached.content, cached: true };
  }

  const userPrompt = [
    `【目标】${goal.name}${goal.category ? `（${goal.category}）` : ''}`,
    `【目标金额】¥${goal.amount.toFixed(0)}`,
    `【当前进度】已花 ¥${progress.spent.toFixed(0)} / 剩余 ¥${progress.remaining.toFixed(0)}`,
    `【完成度】${progress.percent}%`,
    `【剩余天数】${progress.daysLeft} 天`,
    `【日均消费】¥${progress.dailyAvg.toFixed(0)}`,
    `【日均预算】¥${progress.dailyBudget.toFixed(0)}/天`,
    `【状态】${progress.onTrack ? '✅ 在轨道上' : '⚠️ 可能超支'}`,
  ].join('\n');

  const result = await callAiApi({
    system: GOAL_SYSTEM_PROMPT,
    userMessage: userPrompt,
    temperature: 0.4,
    maxTokens: 400,
  });

  if (result.ok) {
    await setCache(goalCacheKey, { content: result.content });
  }

  return result;
}

function isSameWeek(d1, d2) {
  const start1 = new Date(d1);
  start1.setDate(start1.getDate() - start1.getDay());
  start1.setHours(0, 0, 0, 0);

  const start2 = new Date(d2);
  start2.setDate(start2.getDate() - start2.getDay());
  start2.setHours(0, 0, 0, 0);

  return start1.getTime() === start2.getTime();
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
