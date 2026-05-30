import AuthenticationServices
import Foundation
import React
import UIKit

@objc(AppleAuthModule)
final class AppleAuthModule: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(signIn:rejecter:)
  func signIn(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if pendingResolve != nil || pendingReject != nil {
      reject("apple_sign_in_in_progress", "Apple sign-in is already in progress.", nil)
      return
    }

    pendingResolve = resolve
    pendingReject = reject

    let request = ASAuthorizationAppleIDProvider().createRequest()
    request.requestedScopes = [.fullName, .email]

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }

    for scene in scenes {
      if let keyWindow = scene.windows.first(where: \.isKeyWindow) {
        return keyWindow
      }
    }

    return ASPresentationAnchor()
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
      rejectPending(code: "apple_sign_in_failed", message: "Apple sign-in did not return credentials.", error: nil)
      return
    }

    guard
      let identityTokenData = credential.identityToken,
      let identityToken = String(data: identityTokenData, encoding: .utf8)
    else {
      rejectPending(code: "apple_sign_in_failed", message: "Apple sign-in did not return a valid identity token.", error: nil)
      return
    }

    let authorizationCode =
      credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""

    let fullNameParts = [
      credential.fullName?.givenName,
      credential.fullName?.familyName,
    ]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    resolvePending([
      "authorizationCode": authorizationCode,
      "email": credential.email ?? "",
      "fullName": fullNameParts.joined(separator: " "),
      "identityToken": identityToken,
      "user": credential.user,
    ])
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithError error: Error
  ) {
    let nsError = error as NSError

    if nsError.domain == ASAuthorizationError.errorDomain && nsError.code == ASAuthorizationError.canceled.rawValue {
      rejectPending(code: "apple_sign_in_cancelled", message: "Apple sign-in was cancelled.", error: error)
      return
    }

    rejectPending(code: "apple_sign_in_failed", message: error.localizedDescription, error: error)
  }

  private func resolvePending(_ value: [String: Any]) {
    pendingResolve?(value)
    clearPending()
  }

  private func rejectPending(code: String, message: String, error: Error?) {
    pendingReject?(code, message, error)
    clearPending()
  }

  private func clearPending() {
    pendingResolve = nil
    pendingReject = nil
  }
}
