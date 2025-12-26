import Dexie from 'dexie';

export const db = new Dexie('pmsSalaryManagerDB');

db.version(1).stores({
  daily_entries: '++local_id, id, user_id, entry_date, day_type, tonnage, [user_id+entry_date], synced', 
  daily_earnings: '++local_id, id, entry_local_id, user_id, worker_name, earning, attendance_status',
  sync_queue: '++id, type, data, timestamp',
});

db.version(2).stores({
  agreements: '++local_id, [user_id+agreement_name]', 
  workers: '++local_id, worker_name, user_id'
});

db.version(3).stores({
  settings: '++local_id, user_id'
});

db.version(4).stores({
  profiles: 'id'
});

db.version(5).stores({
  daily_entries: '++local_id, id, user_id, entry_date, day_type, tonnage, [user_id+entry_date], synced, wagons'
});

// --- YEH HAI NAYI TABDEELI ---
// Version 6 mein hum offline session ka table shamil kar rahe hain
db.version(6).stores({
  offline_session: '&id, user' // '&id' ka matlab hai ke 'id' unique primary key hai
});

db.version(7).stores({
  daily_earnings: '++local_id, id, entry_local_id, user_id, worker_name, earning, attendance_status, entry_date'
});