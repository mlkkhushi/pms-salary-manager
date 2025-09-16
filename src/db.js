import Dexie from 'dexie';

export const db = new Dexie('pmsSalaryManagerDB');

// Version 1 hamara purana schema tha
db.version(1).stores({
  daily_entries: '++local_id, id, user_id, entry_date, day_type, tonnage, [user_id+entry_date], synced', 
  daily_earnings: '++local_id, id, entry_local_id, user_id, worker_name, earning, attendance_status',
  sync_queue: '++id, type, data, timestamp',
});

// Version 2 mein hum naye tables shamil kar rahe hain
db.version(2).stores({
  // --- YEH HAI TABDEELI ---
  // Ab user_id aur agreement_name par ek saath tezi se search hoga
  agreements: '++local_id, [user_id+agreement_name]', 
  workers: '++local_id, worker_name, user_id'
});

// Version 3 mein hum settings ka table shamil kar rahe hain
db.version(3).stores({
  settings: '++local_id, user_id'
});