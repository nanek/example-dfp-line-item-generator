# Example DFP Line Item Generator

## State of this project
This project was originally developed for internal use at Curiosity Media. Though much of the code is reusable, it is not plug-and-play. It likely require a developer to modify and execute these scripts to fit your particular set up.

Note that some conventions specific to our team at Curiosity Media are inherent in the code. They're pointed out as best as possible.

### Issues and questions

If you find any bugs, can suggest any improvements or find any part of the repository unclear, please report it in [the issues](https://github.com/spanishdict/line-item-generator/issues).

### Code explanantion
###### `lib/dfp.js`
Exposes methods for all the common tasks you need to generate line items. For ease of use, it converts all its functions into promises so that they can be easily chained.

###### `lib/formatter.js`
Formats javascript objects used to create or update records in DFP. This code is imposes a lot of conventions used by our ads A/B testing framework at Curiosity Media, so it should be rewritten for your needs.

###### `lib/user.js`
This file wraps the node-google-dfp to cache services and promisify how they are used.

###### `scripts/*.js`
These are all the scripts we use at Curiosity Media to set up new line items when we onboard a new partner. They string together multiple calls to `lib/dfp.js` and `lib/formatter.js` for ease of use.

### Getting started

Follow our [one-time setup](https://github.com/spanishdict/line-item-generator#one-time-setup).

The process for creating line items:

  - Create an order.
  - Create line items associated with that order.
  - Create creatives for those line items.
  - Create associations between those line items and those creatives.

For each of these steps, write a script that:

  - Calculates all the combinations of parameters that you want to create.
  - Calls `lib/formatter.js` to format a DFP-friendly javascript object for each of those combinations.
  - Calls the appropriate method on `lib/dfp.js` for those combinations.

`lib/dfp.js` is completely reusable. Methods that create or update records in DFP expect to receive a fully formatted javascript object.

`lib/formatter.js` is not reusable as it depends on the conventions of Curiosity Media's DFP setup, but you should be able to follow the model of this code to create your own.

### Curiosity Media's A/B testing conventions
To understand this code it can  be helpful to understand the conventions of our A/B testing framework. For more information on the motivation for this framework, refer to [this article on PubNation's blog](thttp://blog.pubnation.com/ab-testing-ads/).

Our DFP set up for each ad unit:

  - Channel is either A or B
  - Region is the geographic zone that will be targeted, either USA or INT
  - Platform is either Desktop or Mobile (D or M)
  - Position is the name of the ad unit on the page
  _ Price is the CPM * 100 and with leading zeroes and no decimals ($1.50 = "0100")

Naming conventions:

Item       | Name
-----------|------------------------------------------------------
Order      | \<partner\>\_\<channel\>\_\<platform\>\_\<position\>\_\<region\>
Line Items | \<partner\>\_\<channel\>\_\<platform\>\_\<position\>\_\<region\>\_\<price\>
Creatives  | \<partner\>\_\<channel\>\_\<platform\>\_\<position\>\_\<region\>\_\<price\>

Other conventions:

  - One order per channel, region and position.
  - One line item per price point.
  - Number of price points is specified by partner.
  - One creative per line item.

### Scripting large batches

When your DFP tasks take a long time, like creaing a large amoutn of line items, it's possible to run into problems where your node-google-dfp session expires. In this case it can be best to write a node script that creates a smaller number of line items and is executed multiple times by a bash script. The example scripts in `scripts/` are built to avoid this problem. `scripts/create-all-line-items.sh` is an example of how to call a node script multiple times in sequence to avoid this problem. Each call will instantiate a new session.

### One-time setup

#### local/
This project requires a folder in the root directory named `local/`. It is git ignored and contains secrets. It is also where leveldb will create some local data stores, to cache querying DFP.

###### Required Files
- `local/application-creds.json` — Follow "DFP project authorization" below to generate this file.
- `local/config.json` — Follow "Obtain refresh token" below. Create this file with the following format:
```JSON
{
 "networkCode": "<network code>",
 "appName": "<Name of your app>",
 "version": "<version number>",
 "refreshToken": "<refresh token>"
}
```

#### DFP project authorization

Log into Google.

Go to <https://console.developers.google.com/project>. Make a project for your app and then go to <https://console.developers.google.com/project/your-app/apiui/credential>.

Click Download JSON. Save the file as `local/application-creds.json`. It should look like:

```JSON
{
  "installed": {
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_id": "<client id>",
    "client_x509_cert_url": "",
    "redirect_uris": [
      "urn:ietf:wg:oauth:2.0:oob",
      "oob"
    ],
    "client_email": "",
    "token_uri": "https://accounts.google.com/o/oauth2/token",
    "client_secret": "<client secret>",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth"
  }
}
```

#### Obtain refresh token

1. Obtain your network code from DFP. It can be found in your url after you log
   in to DFP. For example in `https://www.google.com/dfp/1027916#delivery`,
   the network code is 1027916.
2. Run:

    ```
    $ node generate-authentication-url.js
    ```

Go to the url and give authorization. Copy the auth code.

3. Run the script in "auth code" mode:

   ```
   $ node generate-refresh-token.js --networkCode <network code> --authCode <auth code>
   ```

This will output a refresh token.

