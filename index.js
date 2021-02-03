const { Requester, Validator } = require('@chainlink/external-adapter')


// Define custom error scenarios for the API.
// Return true for the adapter to retry.
const customError = (data) => {
  if (data.Response === 'Error') return true
  return false
}

// Define custom parameters to be used by the adapter.
// Extra parameters can be stated in the extra object,
// with a Boolean value indicating whether or not they
// should be required.
const customParams = {
  address: ['address'],
  endpoint: false
}

const createRequest = (input, callback) => {
  // The Validator helps you validate the Chainlink request data
  const validator = new Validator(callback, input, customParams)
  const jobRunID = validator.validated.id
  const endpoint = validator.validated.data.endpoint || 'graphql'
  const url = `https://realm.mongodb.com/api/client/v2.0/app/petproject-sfwui/${endpoint}`
  const subAddress = validator.validated.data.address
  
    const query =JSON.stringify({query: `
    query {
        walks (query: {Walker_Address: "${subAddress}"}, sortBy: TIME_WALKED_ASC) {
            Distance_Walked
            Dog_Name
            Time_Walked
            UNIX_Timestamp
            Walker_Address
            Walker_Name
            _id
        }
      }`
    })  

  const config = {
    url,
    headers: {
      "email": "test@gmail.com",
      "password": "test123",
    },
    data: query,
    method: "POST"
  }
  // The Requester allows API calls be retry in case of timeout
  // or connection failure
  Requester.request(config, customError)
    .then(response => {
      // It's common practice to store the desired value at the top-level
      // result key. This allows different adapters to be compatible with
      // one another.
      console.log(response.data.data.walks)
      const pet_response = response.data
      const walkSum = pet_response.data.walks.reduce((sum,d) => {
        return sum + d.Time_Walked
      }, 0)
    
      const distanceSum = pet_response.data.walks.reduce((sum,d) => {
        return sum + d.Distance_Walked
      }, 0)
    
      const dogCountSum = pet_response.data.walks.reduce((sum) => {
        return sum + 1
      }, 0)
      
      const totalPaymentsDue = pet_response.data.walks.reduce((sum,d) => {
        return sum + (d.Distance_Walked*d.Time_Walked)
      }, 0)
    
      // const name = pet_response.data.walks[0].Walker_Name //can't return name because complex array type. 
      // Could make a seperate query for that, but for hackathon it is easier to just check API for matching address. it's like 3box
      const finalResponse = [walkSum*100,distanceSum*100,dogCountSum*100,totalPaymentsDue*100]

      console.log(finalResponse)
      // response.data.result = Requester.validateResultNumber(response.data, ['main','temp'])
      callback(response.status, Requester.success(jobRunID, finalResponse))
    })
    .catch(error => {
      callback(500, Requester.errored(jobRunID, error))
    })
}

// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest
