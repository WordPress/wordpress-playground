#!/bin/sh

# This install script is intended to download and install the latest available
# release of wasienv.

# You can install using this script:
# $ curl https://raw.githubusercontent.com/wasienv/wasienv/master/install.sh | sh
set -e

reset="\033[0m"
blue="\033[44m"
m="\033[34;1m"
bold="\033[1m"
green="\033[32m"
red="\033[31m"
cyan="\033[36m"
white="\033[37m"
dim="\033[2m"

wasienv_detect_profile() {
  if [ -n "${PROFILE}" ] && [ -f "${PROFILE}" ]; then
    echo "${PROFILE}"
    return
  fi

  local DETECTED_PROFILE
  DETECTED_PROFILE=''
  local SHELLTYPE
  SHELLTYPE="$(basename "/$SHELL")"

  if [ "$SHELLTYPE" = "bash" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    fi
  elif [ "$SHELLTYPE" = "zsh" ]; then
    DETECTED_PROFILE="$HOME/.zshrc"
  elif [ "$SHELLTYPE" = "fish" ]; then
    DETECTED_PROFILE="$HOME/.config/fish/config.fish"
  fi

  if [ -z "$DETECTED_PROFILE" ]; then
    if [ -f "$HOME/.profile" ]; then
      DETECTED_PROFILE="$HOME/.profile"
    elif [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    elif [ -f "$HOME/.zshrc" ]; then
      DETECTED_PROFILE="$HOME/.zshrc"
    elif [ -f "$HOME/.config/fish/config.fish" ]; then
      DETECTED_PROFILE="$HOME/.config/fish/config.fish"
    fi
  fi

  if [ ! -z "$DETECTED_PROFILE" ]; then
    echo "$DETECTED_PROFILE"
  fi
}

wasienv_link() {
  printf "${green}${bold}> Adding wasienv to bash profile...${reset}\n"
  WASIENV_PROFILE="$(wasienv_detect_profile)"
  LOAD_STR="\n# Wasienv\nexport WASIENV_DIR=\"$INSTALL_DIRECTORY\"\n[ -s \"\$WASIENV_DIR/wasienv.sh\" ] && source \"\$WASIENV_DIR/wasienv.sh\"\n"
  SOURCE_STR="# Wasienv config\nexport WASIENV_DIR=\"$INSTALL_DIRECTORY\"\nexport PATH=\"\$WASIENV_DIR/bin:\$PATH\"\n"

  # We create the wasienv.sh file
  printf "$SOURCE_STR" > "$INSTALL_DIRECTORY/wasienv.sh"

  if [ -z "${WASIENV_PROFILE-}" ] ; then
    printf "${red}Profile not found. Tried:\n* ${WASIENV_PROFILE} (as defined in \$PROFILE)\n* ~/.bashrc\n* ~/.bash_profile\n* ~/.zshrc\n* ~/.profile.\n"
    echo "\nHow to solve this issue?\n* Create one of them and run this script again"
    echo "* Create it (touch ${WASIENV_PROFILE}) and run this script again"
    echo "  OR"
    printf "* Append the following lines to the correct file yourself:$reset\n"
    command printf "${SOURCE_STR}"
  else
    if ! grep -q 'wasienv.sh' "$WASIENV_PROFILE"; then
      # if [[ $WASIENV_PROFILE = *"fish"* ]]; then
      #   command fish -c 'set -U fish_user_paths $fish_user_paths ~/.wasienv/bin'
      # else
      command printf "$LOAD_STR" >> "$WASIENV_PROFILE"
      # fi
    fi
    printf "\033[1A${green}${bold}> Adding wasienv to bash profile... ✓${reset}\n"
    version=`$INSTALL_DIRECTORY/local/bin/wasienv --version` || (
      printf "$red> wasienv was installed, but doesn't seem to be working :($reset\n"
      exit 1;
    )
  fi
}

if [ -z "$INSTALL_DIRECTORY" ]; then
    if [ -z "$WASIENV_DIR" ]; then
        # If WASMER_DIR is not present
        INSTALL_DIRECTORY="$HOME/.wasienv"
    else
        # If WASMER_DIR is present
        INSTALL_DIRECTORY="${WASIENV_DIR}"
    fi
fi

echo "
 ${m}┏━━━━━━━━━┓${reset}
 ${m}┃         ┃${reset}
 ${m}┃   ${reset}${bold}wasi${m} (${reset} ${bold}env${reset}
 ${m}┃         ┃${reset}
 ${m}┗━━━━━━━━━┛${reset}
"

echo "${green}${bold}> Installing wasienv${reset}"

# Create wasienv directory
mkdir -p $INSTALL_DIRECTORY/bin
if [ -x "$(command -v pip3)" ]; then
  # Uninstall in case it exists
  pip3 uninstall wasienv -y || true
  # Install wasienv in the ~/.wasienv/bin directory
  pip3 install wasienv --prefix=$INSTALL_DIRECTORY --upgrade
  pip3 install wasienv --user
else
  # Uninstall in case it exists
  pip uninstall wasienv -y || true
  # Install wasienv in the ~/.wasienv/bin directory
  pip install wasienv --prefix=$INSTALL_DIRECTORY --upgrade
  pip install wasienv --user
fi

wasienv_link

echo "\n${green}${bold}> Installing a WebAssembly WASI Runtime${reset}"
curl https://get.wasmer.io -sSfL | sh

echo "\n${green}${bold}> Installing the required WASI SDKs${reset}"
# unstable is the most stable version of the WASI sdk for now
$INSTALL_DIRECTORY/local/bin/wasienv install-sdk unstable
$INSTALL_DIRECTORY/local/bin/wasienv default-sdk unstable

printf "\n${reset}${dim}wasienv will be available the next time you open the terminal.\n"
printf "${reset}${dim}If you want to have the commands available now please execute:\n${reset}source $INSTALL_DIRECTORY/wasienv.sh$reset\n"

# Delete the variables from shell
unset -f wasienv_link wasienv_detect_profile