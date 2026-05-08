import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStrategy {
  name: string;
  nameEt: string;
  description: string;
  descriptionEt: string;
  example?: string;
}

export interface IWorkbookCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IWorkbookAsset {
  kind: "page" | "task" | "illustration";
  url: string;
  page: number;
  label?: string;
  sourcePdfName?: string;
  pdfPage?: number;
  crop?: IWorkbookCrop;
  width?: number;
  height?: number;
  checksum?: string;
}

export interface ITask extends Document {
  slug: string;
  title: string;
  titleEt: string;
  problem: string;
  problemEt: string;
  chapter: "counting" | "addition" | "subtraction" | "multiplication" | "division";
  chapterOrder: number;
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
  workbookPart?: "I" | "II";
  workbookTitle?: string;
  sourcePdfName?: string;
  sourcePageNumber?: number;
  sourcePdfPageNumber?: number;
  pageImageUrl?: string;
  workbookAssets: IWorkbookAsset[];
  answer?: string;
  imageUrl?: string;
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

const WorkbookCropSchema = new Schema<IWorkbookCrop>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false }
);

const WorkbookAssetSchema = new Schema<IWorkbookAsset>(
  {
    kind: {
      type: String,
      enum: ["page", "task", "illustration"],
      required: true,
    },
    url: { type: String, required: true },
    page: { type: Number, required: true },
    label: { type: String },
    sourcePdfName: { type: String },
    pdfPage: { type: Number },
    crop: { type: WorkbookCropSchema },
    width: { type: Number },
    height: { type: Number },
    checksum: { type: String },
  },
  { _id: false }
);

const TaskSchema = new Schema<ITask>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleEt: { type: String, required: true },
    problem: { type: String, required: true },
    problemEt: { type: String, required: true },
    chapter: {
      type: String,
      enum: ["counting", "addition", "subtraction", "multiplication", "division"],
      required: true,
    },
    chapterOrder: { type: Number, required: true },
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
    workbookPart: { type: String, enum: ["I", "II"] },
    workbookTitle: { type: String },
    sourcePdfName: { type: String },
    sourcePageNumber: { type: Number },
    sourcePdfPageNumber: { type: Number },
    pageImageUrl: { type: String },
    workbookAssets: { type: [WorkbookAssetSchema], default: [] },
    answer: { type: String },
    imageUrl: { type: String },
    embedding: [Number],
  },
  { timestamps: true }
);

TaskSchema.index({ chapter: 1, chapterOrder: 1 });
TaskSchema.index({ operation: 1, gradeMin: 1 });
TaskSchema.index({ tags: 1 });
TaskSchema.index({ workbookPart: 1, sourcePageNumber: 1 });
TaskSchema.index({ sourcePdfName: 1, sourcePdfPageNumber: 1 });

const Task: Model<ITask> =
  mongoose.models.Task ?? mongoose.model<ITask>("Task", TaskSchema);

export default Task;
