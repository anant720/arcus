import { db } from './config/firebaseAdmin.js';

async function clean() {
  try {
    const snapshot = await db.collection("faculty").get();
    const seen = new Set();
    let deletedCount = 0;
    
    const deletePromises = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const key = `${data.name}_${data.department}`.toLowerCase().trim();
      
      if (seen.has(key)) {
        console.log(`Deleting duplicate: ${data.name} (${data.department})`);
        deletePromises.push(doc.ref.delete());
        deletedCount++;
      } else {
        seen.add(key);
      }
    });

    await Promise.all(deletePromises);
    console.log(`\nSuccessfully deleted ${deletedCount} duplicate faculty records.`);
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning duplicates:", error);
    process.exit(1);
  }
}

clean();
