import { db } from './src/firebase/config';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';

const weekId = '2026-W10';

async function deleteWeek() {
  console.log(`Bắt đầu xóa tuần ${weekId}`);
  const batch = writeBatch(db);
  const shiftsSnap = await getDocs(collection(db, 'weekly_schedules', weekId, 'shifts'));
  let count = 0;
  shiftsSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
    count++;
  });
  batch.delete(doc(db, 'weekly_schedules', weekId));
  await batch.commit();
  console.log(`Đã xóa ${count} ca và tuần ${weekId} thành công!`);
  process.exit(0);
}

deleteWeek().catch(console.error);
