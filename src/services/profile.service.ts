import {toAbsoluteFileUrl, uploadFrappeFile} from './frappe.client';

/**
 * Upload a new profile photo and set it as the signed-in user's
 * `user_image` on the ERPNext User doctype (`userId` is the User's docname —
 * for this app, the same as the account's email).
 */
export async function uploadUserProfileImage(
  userId: string,
  file: {uri: string; name: string; type: string},
): Promise<string> {
  const fileUrl = await uploadFrappeFile(
    file,
    {doctype: 'User', docname: userId, fieldname: 'user_image'},
    'profile photo',
  );
  return toAbsoluteFileUrl(fileUrl) ?? fileUrl;
}
