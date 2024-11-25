// const dns = require('dns');
// const net = require('net');
// const cors = require('cors');
// const fs = require('fs');
// const path = require('path');
// const validator = require('validator');
// const nodemailer = require('nodemailer');
// const rateLimit = require('express-rate-limit');
// const { body, validationResult } = require('express-validator');
// const morgan = require('morgan');
// const express = require('express');
// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());
// app.use(morgan('combined')); // Log requests

// // Rate limit: 100 requests per minute per IP
// const limiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1 minute
//   max: 100, // Limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
// });
// app.use('/validate', limiter);

// // Load lists from files or initialize as empty
// const loadListFromFile = (filePath) => {
//   if (!fs.existsSync(filePath)) {
//     fs.writeFileSync(filePath, '', 'utf8'); // Create file if it doesn't exist
//   }
//   return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
// };

// // Initial lists
// let trapList = loadListFromFile('trapList.txt');
// let spamDomains = loadListFromFile('spamDomains.txt');
// let disposableEmailProviders = loadListFromFile('disposableEmailProviders.txt');

// // Utility functions
// const validateEmailSyntax = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// const isDisposableEmail = (email) => {
//   const domain = email.split('@')[1];
//   return disposableEmailProviders.includes(domain);
// };

// const isTrapEmail = (email) => trapList.includes(email.toLowerCase());

// const isSpamDomain = (domain) => spamDomains.includes(domain.toLowerCase());

// const checkDNS = async (domain) => {
//   return new Promise((resolve, reject) => {
//     const dnsOptions = {
//       timeout: 5000, // Set a timeout of 5 seconds
//     };
//     dns.resolveMx(domain, dnsOptions, (err, addresses) => {
//       if (err || addresses.length === 0) {
//         // Log non-existent MX records separately
//         addToListAndSave(spamDomains, 'spamDomains.txt', domain.toLowerCase()); // Optional: log for review later
//         return reject(new Error('No valid mail servers found for domain.'));
//       }
//       resolve(addresses);
//     });
//   });
// };

// const checkRoutability = async (domain) => {
//   const addresses = await dns.promises.resolve(domain);
//   for (const ip of addresses) {
//     if (/^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
//       throw new Error('Unroutable IP address.');
//     }
//   }
// };

// // Add new entries to lists and persist to file
// const addToListAndSave = (list, filePath, entry) => {
//   if (!list.includes(entry)) {
//     list.push(entry);
//     fs.appendFileSync(filePath, `${entry}\n`, 'utf8');
//   }
// };

// // SMTP check function with timeout and retry logic
// const checkMailServer = async (domain, email) => {
//     return new Promise(async (resolve, reject) => {
//       try {
//         // Resolve MX records for the domain
//         const addresses = await dns.promises.resolveMx(domain);
//         if (addresses.length === 0) {
//           return reject(new Error('No valid mail servers found for domain.'));
//         }
//         console.log(`MX records for ${domain}:`, addresses); // Log the MX records
  
//         // Sort the MX records by priority (ascending order)
//         addresses.sort((a, b) => a.priority - b.priority);
  
//         let attempts = 0;
//         const totalAttempts = addresses.length;
        
//         // SMTP ports to try in order
//         const smtpPorts = [25, 465, 587];
  
//         const tryConnect = (mxRecord, port) => {
//           return new Promise((res, rej) => {
//             const client = net.createConnection(port, mxRecord.exchange, () => {
//               client.write(`EHLO ${domain}\r\n`);
//             });
  
//             let mailFromSent = false;
//             let has220Response = false;
//             let has550Response = false;
//             let connectionActive = true;
  
//             const timeoutDuration = 9000;
//             const connectionTimeout = setTimeout(() => {
//               connectionActive = false;
//               client.end();
//             }, timeoutDuration);
  
//             client.on('data', (data) => {
//               const response = data.toString();
//               console.log('response', response);
//               if (!connectionActive) return;
  
//               if (response.startsWith('220')) {
//                 has220Response = true;
//                 mailFromSent = true;
//                 client.write(`MAIL FROM: <test@${domain}>\r\n`);
//               } else if (mailFromSent && response.startsWith('250')) {
//                 client.write(`RCPT TO: <${email}>\r\n`);
//               } else if (response.startsWith('550')) {
//                 has550Response = true;
//                 client.write('QUIT\r\n');
//               } else if (response.startsWith('221')) {
//                 client.write('QUIT\r\n');
//               }
//             });
  
//             client.on('end', () => {
//               clearTimeout(connectionTimeout);
//               setTimeout(() => {
//                 if (has220Response && !has550Response) {
//                   res('Mail server accepts mail: Valid email address.');
//                 } else if (has220Response && has550Response) {
//                   rej(new Error('Mail server rejected the email address: Invalid email.'));
//                 } else {
//                   rej(new Error('Unable to confirm email validity.'));
//                 }
//               }, 10);
//             });
  
//             client.on('error', (err) => {
//               clearTimeout(connectionTimeout);
//               connectionActive = false;
//               console.log(`Failed to connect on port ${port}: ${err.message}`);
//               rej(new Error(`Error connecting to mail server on port ${port}: ${err.message}`));
//             });
//           });
//         };
  
//         // Attempt to connect to each MX record in order of priority (lowest priority number first)
//         for (const mxRecord of addresses) {
//           attempts++;
//           // Try each port for the current MX record
//           for (const port of smtpPorts) {
//             try {
//               const result = await tryConnect(mxRecord, port);
//               resolve(result); // Return if successful
//               return; // Exit if successful
//             } catch (error) {
//               console.error(`Failed to connect to ${mxRecord.exchange} on port ${port}: ${error.message}`);
//               if (attempts === totalAttempts && port === smtpPorts[smtpPorts.length - 1]) {
//                 reject(new Error('Unable to connect to any SMTP server for this domain.'));
//               }
//             }
//           }
//         }
//       } catch (error) {
//         reject(new Error('Error resolving MX records: ' + error.message));
//       }
//     });
//   };
  
  

// // Main validation function with list checking first
// const validateEmailFull = async (email) => {
//   if (!validateEmailSyntax(email)) {
//     throw new Error("Invalid email syntax or format.");
//   }

//   const domain = email.split('@')[1];

//   // Check against lists first
//   if (isDisposableEmail(email)) {
//     throw new Error("Disposable email address.");
//   }

//   if (isTrapEmail(email)) {
//     addToListAndSave(trapList, 'trapList.txt', email.toLowerCase());
//     throw new Error("Email is a trap address.");
//   }

//   if (isSpamDomain(domain)) {
//     addToListAndSave(spamDomains, 'spamDomains.txt', domain.toLowerCase());
//     throw new Error("Domain is known for spam.");
//   }

//   // Continue with DNS, IP, and SMTP checks
//   await checkDNS(domain);
//   await checkRoutability(domain);
//   await checkMailServer(domain, email);

//   return "Valid email address.";
// };

// // Endpoint to validate multiple emails with input validation
// app.post('/validate', [
//   body('emails').isArray().withMessage('Must be an array of emails'),
//   body('emails.*').isEmail().withMessage('Invalid email format'),
// ], async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({ errors: errors.array() });
//   }

//   const { emails } = req.body;
//   const results = [];
//   const validEmails = [];
//   const failedEmails = [];

//   const validationPromises = emails.map(async (email) => {
//     try {
//       await validateEmailFull(email);
//       validEmails.push(email);
//       return { email, valid: true, reason: 'Valid email address.' };
//     } catch (error) {
//       failedEmails.push(`${email}: ${error.message}`);
//       return { email, valid: false, reason: error.message };
//     }
//   });

//   results.push(...await Promise.all(validationPromises));

//   if (validEmails.length === 0) validEmails.push("No valid emails.");
//   if (failedEmails.length === 0) failedEmails.push("No invalid emails.");

//   const fileContent = [
//     'VALID EMAILS:',
//     ...validEmails,
//     '',
//     'FAILED EMAILS:',
//     ...failedEmails,
//   ].join('\n');

//   const filePath = path.join(__dirname, 'validation_results.txt');
//   fs.writeFileSync(filePath, fileContent);

//   res.json({
//     results,
//     fileUrl: `http://localhost:${PORT}/download/validation_results.txt`,
//   });
// });

// // Endpoint to download the results text file
// app.get('/download/validation_results.txt', (req, res) => {
//   const filePath = path.join(__dirname, 'validation_results.txt');
//   res.download(filePath);
// });

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
