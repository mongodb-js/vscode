#include <stdio.h>
#include <gnome-keyring.h>

int main() {
    GnomeKeyringResult lock_result = gnome_keyring_unlock_sync(NULL,NULL);
    if (lock_result == GNOME_KEYRING_RESULT_OK) {
        printf("Successfully unlocked\n");
        return 0;
    } else {
        printf("Error unlocking keyring: %d\n", lock_result);
        return 1;
    }
}
