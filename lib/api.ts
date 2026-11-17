import api from "./axios";

export const userApi = {
  changePassword: (data: { currentPassword: string; newPassword: string; confirmNewPassword: string }) =>
    api.put("/user/change-password", data),
};
