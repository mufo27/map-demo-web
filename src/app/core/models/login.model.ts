export interface LoginObj {
    username: string;
    password: string;
}
export interface LoginReqModel {
    clientId: string;
    clientSecret: string;
    grantType: string;
    username: string;
    password: string;
}
export interface LoginResModel {
    jwtToken: string;
    tokenType: string;
    expiresIn: number;
    scope?: string;
    apiContextRoot?: string;
    username: string;
    fullName: string;
    roleList: string[];
}
export interface AuthUser {
    jwt_token?: string;
    tokenType?: string;
    expiresIn?: number;
}

export interface UserInfo {
    username?: string;
    fullName?: string;
    scope?: string;
    apiContextRoot?: string;
    roleList?: string[];
}
