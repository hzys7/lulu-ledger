// 璐璐记账 · AI 智能分类建议
// 根据用户输入的备注文本，推荐最可能的分类

// 关键词 → 分类映射（本地规则，无需调用 AI）
const KEYWORD_RULES = {
  // 餐饮
  '餐饮': ['吃饭', '外卖', '餐厅', '饭店', '食堂', '午餐', '晚餐', '早餐', '快餐', '火锅', '烧烤', '面馆', '米线'],
  '零食': ['零食', '小吃', '薯片', '饼干', '糖果', '坚果'],
  '水果': ['水果', '苹果', '香蕉', '橙子', '葡萄', '西瓜', '草莓'],
  '饮品': ['奶茶', '咖啡', '饮料', '茶', '果汁', '星巴克', '瑞幸', '喜茶'],

  // 交通
  '交通': ['打车', '滴滴', '地铁', '公交', '高铁', '火车', '飞机', '机票', '油费', '加油', '停车', '过路费', '出租车', '共享单车'],

  // 购物
  '购物': ['淘宝', '京东', '拼多多', '网购', '超市', '商场', '便利店'],
  '服饰': ['衣服', '裤子', '鞋', '帽', '袜子', '内衣', '外套', '裙子'],
  '美妆': ['化妆品', '护肤品', '口红', '面膜', '洗面奶', '防晒'],
  '日用': ['纸巾', '洗衣液', '牙膏', '洗发水', '沐浴露', '垃圾袋'],

  // 住房
  '住房': ['房租', '水费', '电费', '燃气', '物业', '维修'],
  '居家': ['家居', '收纳', '装饰', '窗帘', '枕头'],

  // 通讯
  '通讯': ['话费', '流量', '宽带', '充值'],

  // 医疗
  '医疗': ['医院', '药', '体检', '看病', '挂号', '牙科', '眼镜'],

  // 教育
  '教育': ['课程', '培训', '书', '学费', '考试', '网课'],

  // 娱乐
  '娱乐': ['电影', '游戏', 'KTV', '演出', '门票', '会员', 'VIP', '订阅'],
  '旅行': ['酒店', '民宿', '旅游', '景点', '门票'],

  // 社交
  '社交': ['红包', '份子钱', '聚餐', '请客', '礼物'],

  // 宠物
  '宠物': ['猫粮', '狗粮', '宠物', '猫砂', '疫苗'],

  // 运动
  '运动': ['健身', '游泳', '瑜伽', '球', '运动'],

  // 数码
  '数码': ['手机', '电脑', '耳机', '充电', '键盘', '鼠标'],

  // 收入
  '工资': ['工资', '薪资', '月薪'],
  '奖金': ['奖金', '年终', '绩效'],
  '红包': ['收到红包', '转账收入'],
};

/**
 * 根据备注文本推荐分类
 * @param {string} note - 用户输入的备注
 * @param {string} type - 'expense' | 'income'
 * @returns {Array<{ category: string, confidence: number }>} 推荐列表，按置信度降序
 */
export function suggestCategories(note, type = 'expense') {
  if (!note || !note.trim()) return [];

  const text = note.toLowerCase();
  const scores = {};

  for (const [category, keywords] of Object.entries(KEYWORD_RULES)) {
    // 根据类型过滤
    if (type === 'expense' && ['工资', '奖金'].includes(category)) continue;
    if (type === 'income' && !['工资', '奖金', '红包'].includes(category)) continue;

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // 精确匹配得分更高
        const exactMatch = text === keyword || text.startsWith(keyword) || text.endsWith(keyword);
        scores[category] = (scores[category] || 0) + (exactMatch ? 2 : 1);
      }
    }
  }

  if (Object.keys(scores).length === 0) return [];

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, score], idx) => ({
      category,
      confidence: Math.min(0.95, 0.5 + score * 0.15),
    }));
}

/**
 * 获取分类的置信度描述
 * @param {number} confidence - 置信度 0-1
 * @returns {string}
 */
export function confidenceLabel(confidence) {
  if (confidence >= 0.8) return '高';
  if (confidence >= 0.6) return '中';
  return '低';
}
