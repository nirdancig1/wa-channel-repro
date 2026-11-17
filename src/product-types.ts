/**
 * undefined
 */
export interface IUsersEntity {
  /** User name  */
  name?: string;
  /** First name  */
  firstName?: string;
  /** Last name  */
  lastName?: string;
  /** Email address  */
  email?: string;
  /** Profile image URL  */
  profileImageUrl?: string;
  /** The user's permission on the app: 'build' (can change the app) or 'use'  */
  permission?: string;
}

export const UsersEntity = {
  tableBlockId: "Users",
  instanceType: {} as IUsersEntity,
} as const;

export const HomePage = "Home";

export const NotFoundPage = "NotFound";

export const PurchasingAssistantAgent = {
  id: "PurchasingAssistant",
  name: "PurchasingAssistant",
  title: "Ron",
  jobTitle: "Purchasing Assistant",
  photoUrl:
    "https://res.cloudinary.com/blocksws/image/upload/Blocks/app-agents/Ron/Ron_image.png",
  avatarUrl:
    "https://res.cloudinary.com/blocksws/image/upload/Blocks/app-agents/Ron/Ron_avatar.png",
} as const;
