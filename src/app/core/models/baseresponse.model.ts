export interface BaseResponseModel {
    success: boolean;
    errorCode: string;
    errorMessage?: string;
    errorDebug?: string;
    data?: any;
}
