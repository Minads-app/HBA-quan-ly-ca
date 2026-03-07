import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Shift registration function using HTTP Callable
export const registerShift = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in to register for a shift."
    );
  }

  const { weekId, shiftId, role } = data;
  if (!weekId || !shiftId || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: weekId, shiftId, role"
    );
  }

  // Define allowed roles
  if (!["manager", "cashier", "ticket_checker"].includes(role)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid role specified."
    );
  }

  const db = admin.firestore();
  const shiftRef = db
    .collection("weekly_schedules")
    .doc(weekId)
    .collection("shifts")
    .doc(shiftId);

  try {
    const result = await db.runTransaction(async (transaction: admin.firestore.Transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Shift not found.");
      }

      const shiftData = shiftDoc.data();
      if (!shiftData) {
         throw new functions.https.HttpsError("not-found", "Shift data not found.");
      }

      // Check if the shift is closed/locked (Friday 23:59 rule)
      if (shiftData.status === "locked") {
         throw new functions.https.HttpsError("failed-precondition", "This shift is locked.");
      }

      // Check for Anti-Overbooking
      if (shiftData.staff && shiftData.staff[role] !== null) {
        throw new functions.https.HttpsError(
          "already-exists",
          `The ${role} position is already taken.`
        );
      }

      const uid = context.auth?.uid;
      if (!uid) {
         throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
      }

      // Get user data
      const userDoc = await transaction.get(db.collection("users").doc(uid));
      const userData = userDoc.data();
      const userName = userData ? userData.fullName : "Unknown";

      // Register the user
      transaction.update(shiftRef, {
        [`staff.${role}`]: {
          userId: uid,
          name: userName,
        },
      });

      return { success: true, message: "Successfully registered for shift." };
    });

    return result;
  } catch (error: any) {
    console.error("Transaction failed: ", error);
    // Rethrow HttpsError back to the client
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message);
  }
});
