import React from 'react';
import * as FlexWebChat from "@twilio/flex-webchat-ui";

class App extends React.Component {

  state = {};

  constructor(props) {
    super(props);

    // Alter the predefined Message
    FlexWebChat.MessagingCanvas.defaultProps.predefinedMessage.authorName = 'Cloud City Healthcare';
    FlexWebChat.MessagingCanvas.defaultProps.predefinedMessage.body = ' 👋 Are you a new or existing patient?';
  
    // Alter the Welcome Message
    FlexWebChat.MessageList.WelcomeMessage = 'Welcome to Cloud City Healthcare, I hope you are having a wonderful day!, ';

    // Chat Header Customizations
    FlexWebChat.MainHeader.defaultProps.imageUrl = './images/healthcare-black-alpha-logo.svg';
    FlexWebChat.MainHeader.defaultProps.titleText = "Chat with us";
    FlexWebChat.MainHeader.defaultProps.showTitle = true;

    FlexWebChat.EntryPoint.defaultProps.hideTaglineWhenExpanded = false;
    FlexWebChat.MainContainer.defaultProps.bottom = '26px';
    FlexWebChat.MainContainer.defaultProps.right = '30px';
  }
  

  render() {
    const { manager, error } = this.state;

    if (manager) {
      return (
        <div>
          <FlexWebChat.ContextProvider manager={manager}>
            <FlexWebChat.RootContainer />
          </FlexWebChat.ContextProvider>
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
