// 自动备份工具 - 本地定期自动备份
import { File, Directory, Paths } from 'expo-file-system';
import * as storage from './storage';

const BACKUP_DIR = 'backups';
const backupDir = new Directory(Paths.document, BACKUP_DIR);

// 最多保留的备份数量
const MAX_BACKUPS = 10;

// 获取备份设置
export function getAutoBackupSettings(settings) {
  return {
    enabled: settings?.autoBackupEnabled ?? false,
    frequency: settings?.autoBackupFrequency ?? 'weekly',
    lastBackupTime: settings?.autoBackupLastTime ?? null,
    keepCount: settings?.autoBackupKeepCount ?? MAX_BACKUPS,
  };
}

// 保存备份设置
export async function saveAutoBackupSettings(updates) {
  await storage.updateSettings(updates);
}

// 检查是否需要备份
export function shouldBackup(settings) {
  const { enabled, frequency, lastBackupTime } = getAutoBackupSettings(settings);
  if (!enabled) return false;
  if (!lastBackupTime) return true;

  const last = new Date(lastBackupTime);
  const now = new Date();
  const diffMs = now - last;

  switch (frequency) {
    case 'daily':
      return diffMs >= 24 * 60 * 60 * 1000;
    case 'weekly':
      return diffMs >= 7 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return diffMs >= 30 * 24 * 60 * 60 * 1000;
    default:
      return false;
  }
}

// 执行自动备份
export async function performAutoBackup() {
  try {
    const data = await storage.exportAllData();
    if (!data || !data.transactions || data.transactions.length === 0) {
      return { success: false, reason: 'no_data' };
    }

    const now = new Date();
    const timestamp = formatTimestamp(now);
    const fileName = `auto_backup_${timestamp}.json`;
    const jsonContent = JSON.stringify(data, null, 2);

    // 确保备份目录存在
    if (!backupDir.exists) {
      backupDir.create();
    }

    // 写入备份文件
    const file = new File(backupDir, fileName);
    file.write(jsonContent);

    // 更新设置
    await saveAutoBackupSettings({
      autoBackupLastTime: now.toISOString(),
      autoBackupLastFile: fileName,
    });

    // 清理旧备份（保留最近 MAX_BACKUPS 个）
    cleanupOldBackupsSync();

    return { success: true, fileName, timestamp };
  } catch (e) {
    console.error('[AutoBackup] Failed:', e);
    return { success: false, reason: e.message };
  }
}

// 同步清理旧备份，保留最近 N 个
function cleanupOldBackupsSync() {
  try {
    if (!backupDir.exists) return;

    const items = backupDir.list();
    const backupFiles = items
      .filter(item => item instanceof File && item.name.startsWith('auto_backup_') && item.name.endsWith('.json'))
      .map(item => ({ name: item.name, file: item }))
      .sort((a, b) => b.name.localeCompare(a.name)); // 最新的在前

    // 删除超出数量的旧备份
    if (backupFiles.length > MAX_BACKUPS) {
      const toDelete = backupFiles.slice(MAX_BACKUPS);
      for (const { name, file } of toDelete) {
        try {
          file.delete();
        } catch (e) {
          console.warn('[AutoBackup] Failed to delete:', name);
        }
      }
    }
  } catch (e) {
    console.warn('[AutoBackup] Cleanup failed:', e);
  }
}

// 获取所有自动备份文件列表
export function listAutoBackups() {
  try {
    if (!backupDir.exists) return [];

    const items = backupDir.list();
    const backups = [];
    for (const item of items) {
      if (item instanceof File && item.name.startsWith('auto_backup_') && item.name.endsWith('.json')) {
        backups.push({
          name: item.name,
          size: item.size,
          uri: item.uri,
        });
      }
    }
    return backups.sort((a, b) => b.name.localeCompare(a.name));
  } catch (e) {
    console.warn('[AutoBackup] List failed:', e);
    return [];
  }
}

// 从备份恢复数据
export function restoreFromBackup(backupUri) {
  try {
    const file = new File(backupUri);
    const content = file.text();
    const data = JSON.parse(content);

    if (!data.transactions && !data.books && !data.budgets) {
      throw new Error('备份文件格式无效');
    }

    // 注意：这里需要异步调用 storage.importData
    // 但由于 File API 是同步的，我们返回数据让调用者处理
    return { success: true, data };
  } catch (e) {
    console.error('[AutoBackup] Restore failed:', e);
    return { success: false, reason: e.message };
  }
}

// 删除指定备份
export function deleteBackup(fileName) {
  try {
    const file = new File(backupDir, fileName);
    file.delete();
    return { success: true };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

function formatTimestamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}_${h}${min}`;
}
