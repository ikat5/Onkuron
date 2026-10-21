import { Schema, type Types } from "mongoose";
import { CATEGORY_ICONS, CATEGORY_SLUG_RE } from "@/lib/categories";
import { AssetSchema, type IAsset } from "./Course";
import { model } from "./util";

/**
 * A learning category managed from the admin panel. Courses reference it by
 * slug (Course.category); published categories appear on the homepage
 * "What would you like to learn?" section and as catalogue filters.
 */
export interface ICategory {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  /** Optional short badge shown on the card, e.g. "Most popular". */
  label?: string;
  icon: string;
  image?: IAsset;
  order: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 60, match: CATEGORY_SLUG_RE },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", maxlength: 300 },
    label: { type: String, trim: true, maxlength: 30 },
    icon: { type: String, enum: CATEGORY_ICONS, default: "book" },
    image: AssetSchema,
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ published: 1, order: 1 });

export const Category = model<ICategory>("Category", CategorySchema);
