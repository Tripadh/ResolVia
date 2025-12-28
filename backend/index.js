import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());


  function analyzeComplaint(text) {
  const lower = text.toLowerCase();

  /* ===============================
     CATEGORY DETECTION
  =============================== */
  let category = "General";

  if (
    lower.includes("hostel") ||
    lower.includes("water") ||
    lower.includes("room") ||
    lower.includes("mess") ||
    lower.includes("food")
  ) {
    category = "Hostel";
  } 
  else if (
    lower.includes("fee") ||
    lower.includes("fees") ||
    lower.includes("payment") ||
    lower.includes("refund") ||
    lower.includes("scholarship")
  ) {
    category = "Finance";
  } 
  else if (
    lower.includes("exam") ||
    lower.includes("marks") ||
    lower.includes("grade") ||
    lower.includes("result") ||
    lower.includes("class") ||
    lower.includes("lecture")
  ) {
    category = "Academics";
  } 
  else if (
    lower.includes("admin") ||
    lower.includes("office") ||
    lower.includes("document") ||
    lower.includes("certificate") ||
    lower.includes("permission")
  ) {
    category = "Administration";
  } 
  else if (
    lower.includes("wifi") ||
    lower.includes("internet") ||
    lower.includes("network") ||
    lower.includes("bus") ||
    lower.includes("transport") ||
    lower.includes("electricity")
  ) {
    category = "Infrastructure";
  }

  /* ===============================
     PRIORITY DETECTION
  =============================== */
  let priority = "Low";

  if (
    lower.includes("urgent") ||
    lower.includes("immediately") ||
    lower.includes("asap") ||
    lower.includes("emergency")
  ) {
    priority = "Critical";
  } 
  else if (
    lower.includes("delay") ||
    lower.includes("problem") ||
    lower.includes("issue") ||
    lower.includes("not working") ||
    lower.includes("failed")
  ) {
    priority = "High";
  } 
  else if (
    lower.includes("request") ||
    lower.includes("please") ||
    lower.includes("kindly")
  ) {
    priority = "Medium";
  }

  /* ===============================
     EMOTION DETECTION
  =============================== */
  let emotion = "Calm";

  if (
    lower.includes("angry") ||
    lower.includes("furious") ||
    lower.includes("outraged")
  ) {
    emotion = "Angry";
  } 
  else if (
    lower.includes("frustrated") ||
    lower.includes("irritated") ||
    lower.includes("annoyed") ||
    lower.includes("disappointed")
  ) {
    emotion = "Frustrated";
  } 
  else if (
    lower.includes("sad") ||
    lower.includes("upset") ||
    lower.includes("worried")
  ) {
    emotion = "Disappointed";
  } 
  else if (
    lower.includes("thank") ||
    lower.includes("happy") ||
    lower.includes("satisfied") ||
    lower.includes("appreciate")
  ) {
    emotion = "Satisfied";
  }

  /* ===============================
     SUMMARY GENERATION
  =============================== */
  const summary =
    text.length > 100
      ? text.slice(0, 100) + "..."
      : text;

  return {
    summary,
    category,
    priority,
    emotion,
  };
}


app.post("/analyze-complaint", (req, res) => {
  const { complaintText } = req.body;

  if (!complaintText) {
    return res.status(400).json({ success: false, error: "Complaint text required" });
  }

  const analysis = analyzeComplaint(complaintText);

  res.json({ success: true, analysis });
});

app.listen(5000, () => {
  console.log("🚀 Static AI API running on http://localhost:5000");
});
