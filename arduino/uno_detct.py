
import subprocess
import time

ARDUINO_ID = "3457301158"

def arduino_connected():
    result = subprocess.run(
        ["adb", "devices"],
        capture_output=True,
        text=True
    )

    return any(
        line.split() == [ARDUINO_ID, "device"]
        for line in result.stdout.splitlines()
    )


def hello_world():
    code = '''
def hello_world():
    print("Hello World!")

hello_world()
'''

    result = subprocess.run(
        ["adb", "-s", ARDUINO_ID, "shell", "python3", "-"],
        input=code,
        capture_output=True,
        text=True,
        timeout=10
    )

    if result.returncode == 0:
        print(result.stdout.strip())
        print("Arduino UNO Q detected successfully!")
    else:
        print("Error:", result.stderr.strip())


def main():
    print("Waiting for Arduino UNO Q...")
    was_connected = False

    while True:
        try:
            connected = arduino_connected()

            if connected and not was_connected:
                hello_world()

            if not connected and was_connected:
                print("Arduino disconnected.")

            was_connected = connected
            time.sleep(1)

        except KeyboardInterrupt:
            print("\nStopped monitoring.")
            break


if __name__ == "__main__":
    main()
