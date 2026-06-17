// 自动备份工具 - 本地定期自动备份
import { File, Paths } from 'expo-file-system';
import * as storage from './storage';

const BACKUP_DIR = 'backups';
const MAX_BACKUPS = 10; // 最多保留 10 个备份

// 获取备份设置
export function getAutoBackupSettings(settings) {
  return {
    enabled: settings?.autoBackupEnabled ?? false,
    frequency: settings?.autoBackupFrequency ?? 'weekly', // daily | weekly | monthly
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

// 执行自动备份（静默，不弹窗）
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
    const backupDirPath = `${Paths.document}/${BACKUP_DIR}`;
    const dirInfo = await File.getInfoAsync(backupDirPath);
    if (!dirInfo.exists) {
      await File.makeDirectoryAsync(backupDirPath, { intermediates: true });
    }

    // 写入备份文件
    const file = new File(backupDirPath, fileName);
    await file.write(jsonContent);

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

    const backupDirPath = `${Paths.document}/${BACKUP_DIR}`;
    const dirInfo = await File.getInfoAsync(backupDirPath);
    if (!dirInfo.exists) return;

    const files = await File.readDirectoryAsync(backupDirPath);
    const backupFiles = files
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.json'))
      .sort()
      .reverse(); // 最新的在前

    // 删除超出保留数量的旧备份
    if (backupFiles.length > keepCount) {
      const toDelete = backupFiles.slice(keepCount);
      for (const f of toDelete) {
        try {
          await File.deleteAsync(`${backupDirPath}/${f}`);
        } catch (e) {
          console.warn('[AutoBackup] Failed to delete old backup:', f, e);
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
    const backupDirPath = `${Paths.document}/${BACKUP_DIR}`;
    const dirInfo = await File.getInfoAsync(backupDirPath);
    if (!dirInfo.exists) return [];

    const files = await File.readDirectoryAsync(backupDirPath);
    const backups = [];
    for (const f of files) {
      if (f.startsWith('auto_backup_') && f.endsWith('.json')) {
        const fileInfo = await File.getInfoAsync(`${backupDirPath}/${f}`);
        backups.push({
          name: f,
          size: fileInfo.size,
          uri: fileInfo.uri,
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
    const content = await file.text();
    const data = JSON.parse(content);

    // 验证数据格式
    if (!data.transactions && !data.books && !data.budgets) {
      throw new Error('备份文件格式无效');
    }

    // 导入数据
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
    const backupDirPath = `${Paths.document}/${BACKUP_DIR}`;
    await File.deleteAsync(`${backupDirPath}/${fileName}`);
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
