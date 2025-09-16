import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { db } from '../db'; // Dexie database instance
import { message } from 'antd';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncData = useCallback(async () => {
    // Agar pehle se sync ho raha hai ya offline hain to foran ruk jayein
    if (isSyncing || !isOnline) return;

    const pendingOperations = await db.sync_queue.orderBy('timestamp').toArray();
    if (pendingOperations.length === 0) {
      return; // Sync karne ke liye kuch nahi hai
    }

    setIsSyncing(true);
    message.info('Starting data synchronization...');

    for (const op of pendingOperations) {
      try {
        if (op.type === 'create_daily_entry') {
          const { entry, earnings } = op.data;
          
          await supabase.from('daily_entries').delete().match({ user_id: entry.user_id, entry_date: entry.entry_date });

          const { data: newEntry, error: entryError } = await supabase.from('daily_entries').insert({ user_id: entry.user_id, entry_date: entry.entry_date, day_type: entry.day_type, tonnage: entry.tonnage }).select('id').single();
          if (entryError) throw entryError;

          const earningsToInsert = earnings.map(e => ({ ...e, entry_id: newEntry.id }));
          const { error: earningsError } = await supabase.from('daily_earnings').insert(earningsToInsert);
          if (earningsError) throw earningsError;

          // Kamyab hone par, local entry ko bhi 'synced' mark karein
          const entryToUpdate = await db.daily_entries.where({ user_id: entry.user_id, entry_date: entry.entry_date }).first();
          if (entryToUpdate) {
            await db.daily_entries.update(entryToUpdate.local_id, { synced: true });
          }

          // Operation ko queue se delete kar dein
          await db.sync_queue.delete(op.id);
          message.success(`Entry for ${entry.entry_date} synced successfully!`);
        }
      } catch (error) {
        console.error(`Operation ${op.id} sync nahi ho saka:`, error.message);
        message.error(`Failed to sync entry for ${op.data.entry.entry_date}.`);
        break; 
      }
    }

    setIsSyncing(false);
  }, [isOnline, isSyncing]); // isSyncing ko yahan rehne dein taake check ho sake, lekin shuru mein return guard loop ko rokega

  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(() => syncData(), 2000); // Thora sa delay dein
      return () => clearTimeout(timer);
    }
  }, [isOnline, syncData]);

  const value = { isOnline, isSyncing, triggerSync: syncData };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};