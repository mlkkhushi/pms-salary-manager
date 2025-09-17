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
  agreements: '++local_id, [user_id+agreement_name]', 
  workers: '++local_id, worker_name, user_id'
});

// Version 3 mein hum settings ka table shamil kar rahe hain
db.version(3).stores({
  settings: '++local_id, user_id'
});

// Version 4 mein hum profiles ka table shamil kar rahe hain
db.version(4).stores({
  profiles: 'id'
});

// --- FINAL UPDATE ---
// Version 5 mein hum 'daily_entries' table ko update kar rahe hain.
// Is baar hum 'wagons' ko aakhir mein rakh rahe hain taake Dexie isay sahi se pehchan sake.
db.version(5).stores({
  daily_entries: '++local_id, id, user_id, entry_date, day_type, tonnage, [user_id+entry_date], synced, wagons'
});