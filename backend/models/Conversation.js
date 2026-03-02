import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true, maxlength: 2000 }
}, { timestamps: true, _id: true });

const conversationSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  messages: { type: [messageSchema], default: [] }
}, { timestamps: true });

// Keep last 60 messages to avoid unbounded growth
conversationSchema.methods.addAndTrim = function(role, content) {
  this.messages.push({ role, content });
  if (this.messages.length > 60) {
    this.messages = this.messages.slice(-60);
  }
};

export default mongoose.model("Conversation", conversationSchema);
