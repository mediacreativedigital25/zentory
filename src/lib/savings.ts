import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";

export async function processCustomerSavings({
  orderId,
  orderTotal,
  customerId,
  tenantId,
}: {
  orderId: string;
  orderTotal: number;
  customerId?: string | null;
  tenantId: string;
}) {
  if (!customerId) return;

  // 1. Get Tenant settings
  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  if (!tenantSnap.exists()) return;
  const tenantData = tenantSnap.data();
  const savingsSettings = tenantData.customerSavingsSettings;
  if (!savingsSettings?.enabled) return;

  // 2. Get Customer
  const customerSnap = await getDoc(doc(db, "customers", customerId));
  if (!customerSnap.exists()) return;
  const customerData = customerSnap.data();
  if (!customerData.hasSavingsProgram) return;

  // 3. Get Order
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) return;
  const orderData = orderSnap.data();

  if (orderData.savingsAdded) return; // Prevent double calculation

  // 4. Calculate savings
  let savingsAmount = 0;
  if (savingsSettings.savingsType === "percent") {
    savingsAmount = Math.round((orderTotal * savingsSettings.savingsValue) / 100);
  } else {
    savingsAmount = Math.round(savingsSettings.savingsValue);
  }

  if (savingsAmount <= 0) return;

  // 5. Update Order
  await updateDoc(orderRef, {
    savingsAdded: true,
    savingsAmount: savingsAmount,
  });

  // 6. Update Customer
  await updateDoc(doc(db, "customers", customerId), {
    savingsBalance: increment(savingsAmount),
  });
}

export async function revertCustomerSavings({
  orderId,
  customerId
}: {
  orderId: string;
  customerId: string;
}) {
  // Revert savings given to customer if order payment is undone
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) return;
  const orderData = orderSnap.data();

  if (orderData.savingsAdded && orderData.savingsAmount > 0) {
    // 1. Revert order
    await updateDoc(orderRef, {
      savingsAdded: false,
      savingsAmount: 0
    });
    
    // 2. Revert customer
    await updateDoc(doc(db, "customers", customerId), {
      savingsBalance: increment(-orderData.savingsAmount)
    });
  }
}
