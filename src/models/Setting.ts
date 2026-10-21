import { Schema } from "mongoose";
import { AssetSchema, type IAsset } from "./Course";
import { model } from "./util";

/**
 * Singleton document holding platform configuration editable by the teacher.
 * Payment numbers are *receiving* wallet numbers shown to students — never
 * account credentials.
 */
export interface ISetting {
  key: "platform";
  paymentNumbers: { bkash?: string; nagad?: string; rocket?: string };
  paymentInstructions: string;
  supportEmail?: string;
  supportPhone?: string;
  /**
   * Platform promotional video: the homepage hero right under the header and the admin overview
   * (single source of truth). Either a server-validated YouTube video ID or an uploaded `video`
   * file (one at a time); `thumbnail` is an optional poster image shown before the visitor presses play.
   */
  intro?: { youtubeVideoId?: string; video?: IAsset; title?: string; text?: string; enabled?: boolean; thumbnail?: IAsset };
  /** Starter content is inserted once; afterwards the admin owns it (deleting everything stays deleted). */
  seeded?: { categories?: boolean; topics?: boolean };
  /** Group photo of the teacher panel, shown at the top of Meet Our Teachers. */
  teamPhoto?: IAsset;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>(
  {
    key: { type: String, enum: ["platform"], required: true },
    paymentNumbers: {
      bkash: { type: String, maxlength: 20 },
      nagad: { type: String, maxlength: 20 },
      rocket: { type: String, maxlength: 20 },
    },
    paymentInstructions: { type: String, default: "", maxlength: 2000 },
    supportEmail: { type: String, maxlength: 254 },
    supportPhone: { type: String, maxlength: 20 },
    intro: {
      youtubeVideoId: { type: String, match: /^[A-Za-z0-9_-]{11}$/ },
      video: AssetSchema,
      title: { type: String, maxlength: 120 },
      text: { type: String, maxlength: 1500 },
      /** Homepage promotional video section on/off (missing = on). */
      enabled: Boolean,
      thumbnail: AssetSchema,
    },
    seeded: { categories: Boolean, topics: Boolean },
    teamPhoto: AssetSchema,
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

SettingSchema.index({ key: 1 }, { unique: true });

export const Setting = model<ISetting>("Setting", SettingSchema);
