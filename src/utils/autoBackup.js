// 自动备份工具 - 本地定期自动备份
import { File, Directory, Paths } from 'expo-file-system';
import * as storage from './storage';

const BACKUP_DIR = 'backups';
const backupDir = new Directory(Paths.document, BACKUP_DIR);

// 获取备份设置
export function getAutoBackupSettings(settings) {
  return {
    enabled: settings?.autoBackupEnabled ?? false,
    frequency: settings?.autoBackupFrequency ?? 'weekly',
    lastBackupTime: settings?.autoBackupLastTime ?? null,
    keepCount: settings?.autoBackupKeepCount ?? 5,
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

    // 清理旧备份
    await cleanupOldBackups();

    return { success: true, fileName, timestamp };
  } catch (e) {
    console.error('[AutoBackup] Failed:', e);
    return { success: false, reason: e.message };
  }
}

// 清理旧备份，保留最近 N 个
async function cleanupOldBackups() {
  try {
    const settings = await storage.getSettings();
    const keepCount = settings?.autoBackupKeepCount ?? 5;

    if (!backupDir.exists) return;

    const items = backupDir.list();
    const backupFiles = items
      .filter(item => item instanceof File && item.name.startsWith('auto_backup_') && item.name.endsWith('.json'))
      .map(item => item.name)
      .sort()
      .reverse();

    if (backupFiles.length > keepCount) {
      const toDelete = backupFiles.slice(keepCount);
      for (const name of toDelete) {
        try {
          const f = new File(backupDir, name);
          f.delete();
        } catch (e) {
          console.warn('[AutoBackup] Failed to delete old backup:', name, e);
        }
      }
    }
  } catch (e) {
    console.warn('[AutoBackup] Cleanup failed:', e);
  }
}

// 获取所有自动备份文件列表
export async function listAutoBackups() {
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
export async function restoreFromBackup(backupUri) {
  try {
    const file = new File(backupUri);
    const content = file.text();
    const data = JSON.parse(content);

    if (!data.transactions && !data.books && !data.budgets) {
      throw new Error('备份文件格式无效');
    }

    await storage.importData(data, 'replace');
    return { success: true };
  } catch (e) {
    console.error('[AutoBackup] Restore failed:', e);
    return { success: false, reason: e.message };
  }
}

// 删除指定备份
export async function deleteBackup(fileName) {
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
