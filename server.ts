import express from "express";
import path from "path";
import crypto from "crypto";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./src/lib/firebase";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // TriPay Webhook
  app.post("/api/webhooks/tripay", express.json(), async (req, res) => {
    try {
      const signature = req.headers["x-callback-signature"] as string;
      const callbackEvent = req.headers["x-callback-event"] as string;
      const payload = JSON.stringify(req.body);

      // In a real app, you would verify the signature using your TriPay Private Key
      // const privateKey = process.env.TRIPAY_PRIVATE_KEY;
      // const expectedSignature = crypto.createHmac("sha256", privateKey).update(payload).digest("hex");
      
      console.log("TriPay Webhook received:", callbackEvent, req.body);

      if (callbackEvent === "payment_status" && req.body.status === "PAID") {
        const reference = req.body.merchant_ref; // This would be the Invoice Number ZNT...
        
        // Use regular firebase SDK to update status (Simplified for this environment)
        // In a real production app, use firebase-admin
        console.log(`Invoice ${reference} marked as PAID via TriPay`);
        
        // Note: Actual firestore update would happen here. 
        // For now, we acknowledge the receipt.
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // WordPress User Sync Webhook
  app.post("/api/webhooks/wordpress/user/:tenantId", express.json(), async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { name, email, phone, role } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      // Set type based on role
      const customerType = (role && role.toLowerCase() === "penulis") ? "langganan" : "umum";

      // Generate customer code
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const sequence = (snap.size + 1).toString().padStart(4, '0');
      const newCode = `A${sequence}`;

      // Add to firestore
      await addDoc(collection(db, 'customers'), {
        tenantId,
        name,
        code: newCode,
        email,
        phone: phone || '',
        address: '',
        type: customerType,
        categoryId: '',
        allowTempo: false,
        tempoLimitDays: 30,
        discount: 0,
        hasSavingsProgram: false,
        savingsBalance: 0,
        createdAt: new Date(), // using local date since serverTimestamp might have cross-env issues
      });

      console.log(`Successfully synced WordPress user ${email} to tenant ${tenantId}`);
      res.status(200).json({ success: true, message: "User synced as customer" });
    } catch (error) {
      console.error("WordPress webhook error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
