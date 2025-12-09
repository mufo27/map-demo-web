import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { environment } from './../../../environments/environment';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthUser, UserInfo } from '../models/login.model';
import { LocalService } from './../services/local.service';
import { BaseResponseModel } from '../models/baseresponse.model';

const AUTH_API = environment.apiHost;

const AUTH_USER = 'IaIntranetIdpAuthUser';
const USER_INFO = 'IaIntranetIdpUserInfo';
const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private sessionTimeoutSubject = new BehaviorSubject<number>(3600);
  public currentSessionTimeout = this.sessionTimeoutSubject.asObservable();

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute, private localService: LocalService) {
  }

  // private formatErrors(error: any) {
  //     return throwError(() => error);
  // }

  setSessionTimeout(timeout: number) {
    this.sessionTimeoutSubject.next(timeout);
  }

  isLoggedIn() {
    return this.localService.getJsonValue(AUTH_USER);
  }

  google(idToken: string, appClientId: any): Observable<BaseResponseModel> {
    const url = `${AUTH_API}/api/Auth/google`;
    const body = {
      clientId: environment.clientId,
      clientSecret: environment.clientSecret,
      appClientId: (appClientId) ? appClientId : null,
      grantType: environment.grantType,
      idToken: idToken,
    };
    return this.http.post<BaseResponseModel>(url, body, httpOptions);
  }

  googlev2(code: string, codeVerifier: string, redirectUri: string, appClientId: any): Observable<BaseResponseModel> {
    const url = `${AUTH_API}/api/Auth/googlev2`;
    const body = {
      clientId: environment.clientId,
      clientSecret: environment.clientSecret,
      appClientId: (appClientId) ? appClientId : null,
      grantType: environment.grantType,
      code: code,
      codeVerifier: codeVerifier,
      redirectUri: redirectUri,
    };
    return this.http.post<BaseResponseModel>(url, body, httpOptions);
  }

    googlePayload(code: string, codeVerifier: string, redirectUri: string, appClientId: any): Observable<BaseResponseModel> {
    const url = `${AUTH_API}/api/Auth/googlePayload`;
    const body = {
      clientId: environment.clientId,
      clientSecret: environment.clientSecret,
      appClientId: (appClientId) ? appClientId : null,
      grantType: environment.grantType,
      code: code,
      codeVerifier: codeVerifier,
      redirectUri: redirectUri,
    };
    return this.http.post<BaseResponseModel>(url, body, httpOptions);
  }

  login(username: string, password: string, appClientId: any): Observable<BaseResponseModel> {
    const url = `${AUTH_API}/api/Auth/login`;
    const body = {
      clientId: environment.clientId,
      clientSecret: environment.clientSecret,
      appClientId: (appClientId) ? appClientId : null,
      grantType: environment.grantType,
      username: username,
      password: password,
    };

    return this.http.post<BaseResponseModel>(url, body, httpOptions);
  }

  generateIdpToken(appClientId: any): Observable<BaseResponseModel> {
    const url = `${AUTH_API}/api/Signin/generateToken`;
    const auth: AuthUser = this.getAuthUser();
    const headers = {
      headers: new HttpHeaders(
        {
          'Content-Type': 'application/json',
          'Authorization': `${auth.tokenType} ${auth.jwt_token}`,
        }
      ),
    };
    const body = {
      appClientId: appClientId
    };
    return this.http.post<BaseResponseModel>(url, body, headers);
  }

  register(objBody: any): Observable<BaseResponseModel> {
    const url = `${AUTH_API}/api/Auth/register`;
    const body = {
      email: objBody.email,
      username: objBody.username,
      fullName: objBody.fullName,
      imageProfileUrl: objBody.imageProfileUrl,
      password: (objBody.password) ? objBody.password : null,
      confirmPassword: (objBody.confirmPassword) ? objBody.confirmPassword : null,
    };
    return this.http.post<BaseResponseModel>(url, body, httpOptions);
  }

  setAuth(authUser: AuthUser) {
    this.setSessionTimeout(7200);

    {
      this.localService.setJsonValue(AUTH_USER, JSON.stringify(authUser));
    }
  }

  getUser(): UserInfo {
    return JSON.parse(this.localService.getJsonValue(USER_INFO));
  }

  setUser(user: UserInfo) {
    this.localService.setJsonValue(USER_INFO, JSON.stringify(user));
  }

  getAuthUser(): AuthUser {
    {
      return <AuthUser>JSON.parse(this.localService.getJsonValue(AUTH_USER));
    }
  }

  logout() {
    this.localService.remove(AUTH_USER);
    this.localService.remove(USER_INFO);
    this.router.navigate(['/login']);
  }
  // private handleError(error: HttpErrorResponse): Observable<never> {
  //     let errorMessage = '';
  //     if (error.error instanceof ErrorEvent) {
  //         errorMessage = `Client-side error: ${error.error.message}`;
  //     } else {
  //         errorMessage = `Server-side error: ${error.status} - ${error.message}`;
  //     }
  //     console.error(errorMessage);
  //     return throwError(() => errorMessage);
  // }
}
