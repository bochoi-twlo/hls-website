
// array of user input variable values are stored here
// { key, required, css_class, value, is_valid }
const variableInput = [];

/* -----------------------------------------------------------------------------
 * page loading function
 * -----------------------------------------------------------------------------
 */
$(document).ready(async function () {
    await populate();
    checkDeployment();
});

// ---------- UI element css id list used by functions
const UI = {
  account_name: '#account_name',
  service_deploy: '#service-deploy',
  service_deployed: '#service-deployed',
  service_deploy_button: '#service-deploy-button',
  service_redeploy_button: '#service-redeploy-button',
  service_undeploy_button: '#service-undeploy-button',
  service_deploying: '#service-deploying',
  service_open: '#service-open',
  service_console_open: '#service-console-open',
  information: '#deploy-information',
}



/* -----------------------------------------------------------------------------
 * add configuration variable entry
 *
 * input:
 * - variable: see https://www.npmjs.com/package/configure-env
 */
async function addVariable(variable, currentValue = null) {
  console.log(variable.key, currentValue);

  if (variable.key === 'TWILIO_PHONE_NUMBER') {
    // twilio phone number dropdown is handled outside, TODO: move inside
    variableInput.push({
      key: 'TWILIO_PHONE_NUMBER',
      required: variable.required,
      configurable: variable.configurable,
      css_id: '#twilio_phone_number',
    });
    return;
  }

  const originalElement = $('div.clone-original');

  const clonedElement = originalElement.clone().insertBefore(originalElement);
  clonedElement.removeClass("clone-original");
  clonedElement.addClass("clone-for-" + variable.key);

  const label = variable.key.toLowerCase().split('_').map(word => word[0].toUpperCase() + word.substr(1)).join(' ');
  (variable.required === true) ? clonedElement.find('.star').show() : clonedElement.find('.star').hide();
  clonedElement.find(".configure-label").text(label);

  css_id = `${variable.key.toLowerCase()}`;
  clonedElement.find('input').attr("id", css_id);
  clonedElement.find('input').attr("name", css_id);

  const value = currentValue ? currentValue : (variable.default ? variable.default: '');
  clonedElement.find('input').val(value);
  // clonedElement.find('input').attr("placeholder", (variable.default == null ? ' ' : variable.default));
  clonedElement.find('.tooltip').text(variable.description);
  const formats = {
    "secret": "password",
    "phone_number": "text",
    "email": "text",
    "text": "text"
  };
  clonedElement.find('input').attr("type", (formats.hasOwnProperty(variable.format) ? formats[variable.format] : "text"));

  variableInput.push({
    key: variable.key,
    required: variable.required,
    configurable: variable.configurable,
    css_id: `#${css_id}`,
    value: v.default ? v.default : v.value,
    isValid: true,
  });
  if (variable.configurable) {
    clonedElement.show();
    // } else {
    //     clonedElement.show();
    //     clonedElement.prop('disabled', true);
    //     clonedElement.find('input').prop('disabled', true);
    //     clonedElement.find('.configure-label').css('color','#aaaaaa');
    //     clonedElement.find('input').css('color','#aaaaaa');
  }
  // delete the original div after cloning
  //originalElement.remove();
}



// -----------------------------------------------------------------------------
async function selectPhone() {
    const selectedPhone = $('#twilio_phone_number').val();
    console.log('selected twilio phone:', selectedPhone)
    return selectedPhone;

}


async function validateAdministratorPhone(field, value) {
    return fetch('/installer/validate-phone', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({phone: value})
    })
        .then((response) => {
            if (!response.ok) {
                $(".clone-for-" + field).find(".configure-error").text("'" + value + "' is not a valid E.164 number");
                $(".clone-for-" + field).find(".configure-error").show();
                throw Error();
            }
            return response;
        })
        .then((response) => response.json())
        .then((r) => {
            $("#" + field.toLowerCase()).val(r["phone"]);
            return true;
        })
        .catch((err) => {
            return false;
        });
}


/* --------------------------------------------------------------------------------
 * validates variable input values
 *
 * input:
 * global variableInput set in populate()
 *
 * returns:
 * variableInput adding 2 attributes
 * - value
 * - isValid
 * --------------------------------------------------------------------------------
 */
function validateInput() {
  $('.configure-error').text("");
  $('.configure-error').hide("");

  //console.log(THIS, Object.keys(variableInput));
  let hasValidationError = false;
  for (v of variableInput) {
    if (! v.configurable) continue; // skip non-configurable variables
    console.log(v);
    const inputValue = $(v.css_id).val();
    console.log('input is', inputValue);
    if (v.required && !inputValue) {
      $('.clone-for-' + v.key).find(".configure-error").text("This field is required");
      $('.clone-for-' + v.key).find(".configure-error").show();
      hasValidationError = true;
    }
    v['value'] = inputValue;
    v['isValid'] = ! hasValidationError;
  }

  return variableInput;
}


/* --------------------------------------------------------------------------------
 * populate installer page
 * --------------------------------------------------------------------------------
 */
async function populate() {
  const THIS = populate.name;
  try {
    const response = await fetch('/installer/get-configuration', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const configuration = await response.json();

    console.log(THIS, configuration);

    $('#account_name').val(configuration.twilioAccountName);

    const phoneList = configuration.twilioPhoneNumbers;
    if (phoneList.length === 0)
      $(".configure-error-twilio-phone-number").show();
    phoneList.forEach(phone => {
      const html = `<option value="${phone.phoneNumber}">${phone.friendlyName}</option>`;
      $('#twilio_phone_number').append(html);
    });

    for (v of configuration.configurationVariables) {
      await addVariable(v, v.value);
    }

  } catch (err) {
    console.log(err);
    $(".configure-error-login").text("Your Twilio authentication failed. Please try again with correct credentials");
    $(".configure-error-login").show();
  }
}


/* --------------------------------------------------------------------------------
 * check deployment of all deployables
 * --------------------------------------------------------------------------------
 */
function checkDeployment() {
  const THIS = checkDeployment.name;

  try {
    fetch('/installer/check', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then((raw) => raw.json())
      .then((response) => {
        console.log(THIS, 'server returned:', response);
        if (! response.deploy_state) throw new Error('Missing deployable.deploy_state');

        $('.deployable-loader').hide();
        $('#service-deploy .button').removeClass('loading');
        $('#service-deploy').show();
        if (response.deploy_state === 'NOT-DEPLOYED') {
          $('#service-deployed').hide();
          $('#service-open').hide();
          $('#service-console-open').hide();
          $('#service-deploy-button').show();
          $('#service-deploy-button').css('pointer-events', '');
          $('#service-redeploy-button').hide();
          $('#service-undeploy-button').hide();
        } else if (response.deploy_state === 'DEPLOYED') {
          $('#service-deployed').show();
          $('#service-open').show();
          $('#service-open').attr('href', response.application_url);
          $('#service-console-open').show();
          $('#service-console-open').attr('href', `https://www.twilio.com/console/functions/api/start/${response.service_sid}`);
          $('#service-deploy-button').hide();
          $('#service-redeploy-button').show();
          $('#service-redeploy-button').css('pointer-events', '');
          $('#service-undeploy-button').show();
          $('#service-undeploy-button').css('pointer-events', '');
        }
        $('#service-deploying').hide();
        $(UI.information).text(JSON.stringify(response, undefined, 2));
      });
  } catch (err) {
    console.log(THIS, err);
    window.alert(err);
  }
}


/* --------------------------------------------------------------------------------
 * deploy service
 *
 * action: DEPLOY|REDEPLOY|UNDEPLOY
 * --------------------------------------------------------------------------------
 */
function deploy(e, action) {
  const THIS = deploy.name;

  e.preventDefault();

  const input = validateInput();
  const validated = input.every(i => i.isValid);
  if (! validated) return;

  console.log(THIS, 'variable values validated');

  const configuration = {};
  for (i of input) {
    if (!i.value) continue;
    configuration[i.key] = i.value;
  }
  console.log(configuration);
  console.log(JSON.stringify(configuration));
//    $('#service-deploy .button').addClass('loading');
//    $('.service-loader.button-loader').show();

  $(UI.service_deploy_button).css('pointer-events', 'none');
  $(UI.service_redeploy_button).css('pointer-events', 'none');
  $(UI.service_undeploy_button).css('pointer-events', 'none');
  $(UI.service_deploying).show();

//    return;

  fetch('/installer/deploy', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: action,
      configuration: configuration,
    }),
  })
    .then(() => {
      console.log(THIS, 'successfully');
      checkDeployment();
    })
    .catch ((err) => {
      console.log(THIS, err);
      window.alert(err);
      checkDeployment();
//          $('#service-deploy .button').removeClass('loading');
//          $('.service-loader.button-loader').hide();
    });
}

