# Release signing setup

The upload keystore (`android/app/my-upload-key.keystore`) is already created and
git-ignored. To let Gradle sign release builds with it, add its credentials to
**`~/.gradle/gradle.properties`** (in your home directory, *not* this repo) so they
never get committed.

Run this once, entering the store/key passwords you set with `keytool` when prompted
(they won't be echoed or saved anywhere but that file):

```bash
{
  echo ""
  echo "MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore"
  echo "MYAPP_UPLOAD_KEY_ALIAS=my-key-alias"
  read -s -p "Keystore password: " storepass; echo
  echo "MYAPP_UPLOAD_STORE_PASSWORD=$storepass"
  read -s -p "Key password (usually same as above): " keypass; echo
  echo "MYAPP_UPLOAD_KEY_PASSWORD=$keypass"
} >> ~/.gradle/gradle.properties
```

Then build a signed release from `android/`:

```bash
./gradlew bundleRelease   # AAB for Play Store, at app/build/outputs/bundle/release/
./gradlew assembleRelease # APK, at app/build/outputs/apk/release/
```

If `~/.gradle/gradle.properties` doesn't have these four properties set, the release
build type quietly falls back to the debug key (see `app/build.gradle`) — fine for
local testing, but Play Store will reject that upload.

**Back up `my-upload-key.keystore` and its passwords somewhere safe outside this
machine** (e.g. a password manager). If you lose it, you can never update this app
on Play Store under the same listing again.
