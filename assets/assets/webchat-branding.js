var brandColor1 = "#4B5671";
var brandColor2 = "#F4F4F6";
var msgInputBgColor = "#0263E0";
var brandTextColor = "#ffffff";
var brandTextColor1 = "#ffffff";
var brandTextColor2 = "#121C2D";

var personalizedColors = {
   darkBlueBackground: "#3C425C",
   whiteText: "#FFFFFF",
   entryPointBackground: "#0263E0",
   lighterBackground: "#ecedf1",
   primaryButtonBackground: "#1976d2",
   primaryButtonColor: "#FFFFFF",
   secondaryButtonBackground: "#6e7180",
   secondaryButtonColor: "#FFFFFF"
};

var brandMessageBubbleColors = function (bgBubbleColor, bubleColor) {
    return {
        Bubble: {
            background: bgBubbleColor,
            color: bubleColor
        },
        Avatar: {
            background: bgBubbleColor,
            color: bubleColor
        },
        Header: {
            color: bubleColor
        }
    }
};

var brandedColors = {
    Chat: {
        MessageListItem: {
            FromOthers: brandMessageBubbleColors(brandColor2, brandTextColor2),
            FromMe: brandMessageBubbleColors(brandColor1, brandTextColor1),
        },
        MessageInput: {
            Button: {
                background: msgInputBgColor,
                color: brandTextColor1,

            }
        },
        MessageCanvasTray: {
            Container: {
                background: personalizedColors.darkBlueBackground,
                color: personalizedColors.whiteText
            }
        },
    },

    MainHeader: {
        Container: {
            background: '#F4F4F6',
            color: '#4B5671',
            height: '56px',
            'font-family': 'Inter',
            'font-size': '16px'
        },
        Logo: {
            fill: brandTextColor1
        }
    },

    

    MessagingCanvas: {
        Container: {
            'font-size': '14px'
        }
    },

    MainContainer: {
        Container: {
        }
    },

    EntryPoint: {
        Container: {
            background: personalizedColors.entryPointBackground,
            color: personalizedColors.whiteText,
            right: '124px',
            bottom: '41px',
            'z-index': '99'
        },
    }, 

    PreEngagementCanvas: {
        Container: {
            background: personalizedColors.lighterBackground
        },

        Form: {
            SubmitButton: {
                background: personalizedColors.primaryButtonBackground,
                color: personalizedColors.whiteText
            }
        }
    }
};
