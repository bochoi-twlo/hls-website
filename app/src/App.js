import React from 'react';
import * as FlexWebChat from "@twilio/flex-webchat-ui";
import customState from './store/state';
import customReducer from './store/reducers/customReducer';
import EndChatModal from './components/endChatModal'
import EndChatButton from './components/endChatButton'
import ClickableMessages from './components/clickableMessages'

class App extends React.Component {

  state = {};

  constructor(props) {
    super(props);

    const { configuration } = props;

    // Alter the predefined Message
    FlexWebChat.MessagingCanvas.defaultProps.predefinedMessage.authorName = 'Owl Health';
    FlexWebChat.MessagingCanvas.defaultProps.predefinedMessage.body = ' 👋 Are you a new or existing patient?';
  
    // Alter the Welcome Message
    FlexWebChat.MessageList.WelcomeMessage = 'Welcome to Owl Health, I hope you are having a wonderful day!, ';

    // Chat Header Customizations
    FlexWebChat.MainHeader.defaultProps.imageUrl = './images/logoOwlHealthSmall.png';
    FlexWebChat.MainHeader.defaultProps.titleText = "Chat with Us";
    FlexWebChat.MainHeader.defaultProps.showTitle = true;
      
    FlexWebChat.Manager.create(configuration)
        .then(manager => {

            // set some variables on the global window object
            // these help us determine if flex has loaded or not
            window.Twilio = window.Twilio || {};
            FlexWebChat.manager =  manager;
            manager.strings.WelcomeMessage = "Welcome to Owl Health";
            window.Twilio.FlexWebChat = FlexWebChat;


            // Register the custom redux/reducer
            customState.addReducer('custom', customReducer);
            manager.store.replaceReducer(customState.combinedReducers());

            this.setState({ 
              manager 
            });

            // Add the close button
            FlexWebChat.MessagingCanvas.Content.add(<EndChatModal key="end-chat-modal" />)

            FlexWebChat.MainHeader.Content.remove('close-button');
            FlexWebChat.MainHeader.Content.add(<EndChatButton key="end-chat-button" />, { sortOrder: -1, align: "end" });

            // Add the clickable messages
            FlexWebChat.MessageInput.Content.add(<ClickableMessages key="ClickableMessages" />, {sortOrder: -1});
          
        })
        .catch(error => this.setState({ error }));
  }
  

  render() {
    const { manager, error } = this.state;

    if (manager) {
      return (
        <div>
          <div className="makeStyles-root-1">
            <header
              className="MuiPaper-root MuiAppBar-root MuiAppBar-positionFixed MuiAppBar-colorInherit makeStyles-appBar-2 mui-fixed MuiPaper-elevation4">
              <div className="MuiToolbar-root MuiToolbar-dense makeStyles-toolbar-6 MuiToolbar-gutters">
                <a
                  className="MuiTypography-root MuiLink-root MuiLink-underlineHover makeStyles-title-4 MuiTypography-colorPrimary">
                  <div className="makeStyles-logo-3"></div>
                </a>
                <a
                  className="MuiTypography-root MuiLink-root MuiLink-underlineHover makeStyles-link-8 MuiTypography-colorInherit">Find
                  Care</a>
                <a
                  className="MuiTypography-root MuiLink-root MuiLink-underlineHover makeStyles-link-8 MuiTypography-colorInherit">Caregiver
                  Careers</a>
                <a
                  className="MuiTypography-root MuiLink-root MuiLink-underlineHover makeStyles-link-8 MuiTypography-colorInherit">Contact
                  Us</a>
                <div className="makeStyles-spacer-9"></div>
                <div className="makeStyles-linkGroup-7">
                  <a
                    className="MuiTypography-root MuiLink-root MuiLink-underlineHover makeStyles-link-8 MuiTypography-colorInherit">Register</a>
                  <button className="MuiButtonBase-root MuiButton-root MuiButton-text makeStyles-logBtn-10" tabIndex="0"
                          type="button"><span className="MuiButton-label">Log in</span><span
                    className="MuiTouchRipple-root"></span>
                  </button>
                </div>
              </div>
            </header>
            <div></div>
            <div className="makeStyles-banner-15">
              <div className="MuiContainer-root makeStyles-section-16 MuiContainer-maxWidthLg">
                <div className="MuiGrid-root makeStyles-entry-17 MuiGrid-container">
                  <div className="MuiGrid-root MuiGrid-item MuiGrid-grid-xs-12">
                    <div className="makeStyles-welcomeText-18">Welcome to Owl Health</div>
                  </div>
                  <div className="MuiGrid-root makeStyles-pitchText-19 MuiGrid-item MuiGrid-grid-xs-12">Family-Centered
                    Health
                    Plans Just Right For You
                  </div>
                  <div className="MuiGrid-root makeStyles-subline-20 MuiGrid-item MuiGrid-grid-xs-12">We help
                    individuals and
                    families connect to the best providers for their unique needs.
                  </div>
                  <div className="MuiGrid-root MuiGrid-item MuiGrid-grid-xs-12">
                    <div className="MuiGrid-root MuiGrid-container">
                      <div
                        className="MuiGrid-root makeStyles-card-21 MuiGrid-item MuiGrid-grid-xs-12 MuiGrid-grid-md-4">
                        <h6
                          className="makeStyles-cardHeader-22">Quality Of Life</h6>At Owl Health, love for life is key.
                      </div>
                      <div
                        className="MuiGrid-root makeStyles-card-21 MuiGrid-item MuiGrid-grid-xs-12 MuiGrid-grid-md-4">
                        <h6
                          className="makeStyles-cardHeader-22">Live In Comfort</h6>Quality care in-office, at home, or
                        on
                        the go.
                      </div>
                      <div
                        className="MuiGrid-root makeStyles-card-21 MuiGrid-item MuiGrid-grid-xs-12 MuiGrid-grid-md-4">
                        <h6
                          className="makeStyles-cardHeader-22">Care Professionals Wanted</h6>Contact us to lend a
                        helping
                        hand.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="MuiContainer-root makeStyles-bottomContainer-23 MuiContainer-maxWidthLg">
              <div className="MuiGrid-root makeStyles-bottomCards-24 MuiGrid-container MuiGrid-spacing-xs-4">
                <div
                  className="MuiGrid-root makeStyles-bottomCard-25 MuiGrid-item MuiGrid-grid-xs-12 MuiGrid-grid-md-4">
                  <div className="makeStyles-familyCard-29"><h3 className="makeStyles-bottomCardHeader-26">Familes and
                    Friends</h3>
                    <p className="makeStyles-bottomCardText-28">Comfortable service within your own home. Life life to
                      its
                      fullest with friends and family closer than ever</p>
                    <button
                      className="MuiButtonBase-root MuiButton-root MuiButton-text makeStyles-familyButton-30 makeStyles-bottomCardButton-27"
                      tabIndex="0" type="button"><span className="MuiButton-label">Find Care</span><span
                      className="MuiTouchRipple-root"></span></button>
                  </div>
                </div>
                <div
                  className="MuiGrid-root makeStyles-bottomCard-25 MuiGrid-item MuiGrid-grid-xs-12 MuiGrid-grid-md-4">
                  <div className="makeStyles-helpingCard-31"><h3 className="makeStyles-bottomCardHeader-26">Love
                    Helping?</h3>
                    <p className="makeStyles-bottomCardText-28">If you are called to support, look no further. We have
                      career
                      options for everyone</p>
                    <button
                      className="MuiButtonBase-root MuiButton-root MuiButton-text makeStyles-helpingButton-32 makeStyles-bottomCardButton-27"
                      tabIndex="0" type="button"><span className="MuiButton-label">Career Options</span><span
                      className="MuiTouchRipple-root"></span></button>
                  </div>
                </div>
                <div
                  className="MuiGrid-root makeStyles-bottomCard-25 MuiGrid-item MuiGrid-grid-xs-12 MuiGrid-grid-md-4">
                  <div className="makeStyles-contactUsCard-33"><h3 className="makeStyles-bottomCardHeader-26">Contact Us
                    Today</h3>
                    <p className="makeStyles-bottomCardText-28">Whether it's for you or a loved one. We've helped
                      thousands, let
                      us help you too.</p>
                    <button
                      className="MuiButtonBase-root MuiButton-root MuiButton-text makeStyles-contactUsButton-34 makeStyles-bottomCardButton-27"
                      tabIndex="0" type="button"><span className="MuiButton-label">Contact Us</span><span
                      className="MuiTouchRipple-root"></span></button>
                  </div>
                </div>
              </div>
            </div>
            <div></div>
            <header
              className="MuiPaper-root MuiAppBar-root MuiAppBar-positionFixed MuiAppBar-colorInherit makeStyles-appBar-35 mui-fixed MuiPaper-elevation4">
              <div className="MuiToolbar-root MuiToolbar-regular makeStyles-toolbar-36">
                <ul className="makeStyles-ul-37">
                  <li className="makeStyles-li-38">Owl Health ©</li>
                  <li className="makeStyles-li-38">Privacy Policy</li>
                </ul>
              </div>
            </header>
            <FlexWebChat.ContextProvider manager={manager}>
              <FlexWebChat.RootContainer />
            </FlexWebChat.ContextProvider>
          </div>
        </div>
      );
    }

    if (error) {
      console.error("Failed to initialize Flex Web Chat", error);
    }

    return null;
  }
}

export default App;
