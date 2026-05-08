import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStrategy {
  name: string;
  nameEt: string;
  description: string;
  descriptionEt: string;
  example?: string;
}

export interface ITask extends Document {
  slug: string;
  title: string;
  titleEt: string;
  problem: string;
  problemEt: string;
  operation: "addition" | "subtraction" | "multiplication" | "division" | "mixed";
  gradeMin: number;
  gradeMax: number;
  difficulty: "easy" | "medium" | "hard";
  strategies: IStrategy[];
  facilitation: string;
  facilitationEt: string;
  commonMisconceptions: string[];
  commonMisconceptionsEt: string[];
  tags: string[];
  pageRef?: number;
  answer?: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const StrategySchema = new Schema<IStrategy>({
  name: { type: String, required: true },
  nameEt: { type: String, required: true },
  description: { type: String, required: true },
  descriptionEt: { type: String, required: true },
  example: { type: String },
});

const TaskSchema = new Schema<ITask>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleEt: { type: String, required: true },
    problem: { type: String, required: true },
    problemEt: { type: String, required: true },
    operation: {
      type: String,
      enum: ["addition", "subtraction", "multiplication", "division", "mixed"],
      required: true,
    },
    gradeMin: { type: Number, required: true },
    gradeMax: { type: Number, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    strategies: [StrategySchema],
    facilitation: { type: String, required: true },
    facilitationEt: { type: String, required: true },
    commonMisconceptions: [String],
    commonMisconceptionsEt: [String],
    tags: [String],
    pageRef: { type: Number },
    answer: { type: String },
    embedding: [Number],
  },
  { timestamps: true }
);

TaskSchema.index({ operation: 1, gradeMin: 1 });
TaskSchema.index({ tags: 1 });

const Task: Model<ITask> =
  mongoose.models.Task ?? mongoose.model<ITask>("Task", TaskSchema);

export default Task;
