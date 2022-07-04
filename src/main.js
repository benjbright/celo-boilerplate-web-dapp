// import products from "./products"

import Web3 from "web3"
import { newKitFromWeb3 } from "@celo/contractkit"
import BigNumber from "bignumber.js"
import marketplaceAbi from "../contract/marketplace.abi.json"

// By default the ERC20 interface used a value of 18 for decimals
const ERC20_DECIMALS = 18
// Deploy new contract and copy ABI to marketplace.abi.json
const MPContractAddress = "0xE32A4720359B52cF04425BacFFAeEF96E1Ad3e92"

let kit
let contract
let products = []

// Connect to the Celo extension wallet
const connectCeloWallet = async function () {
  // First check if the user has installed the Celo extension wallet
  // Check if the 'window.celo' object exists
  if (window.celo) {
    try {
      // If the object does exist notify user they need to approve the DApp
      notification("⚠️ Please approve this DApp to use it.")
      // Opens a pop up in the UI that asks for permission to connect the DApp to the wallet
      await window.celo.enable()
      //   After Celo is enabled, should disable the notification
      notificationOff()

      //   Create a web3 object using the window.celo object as provider
      const web3 = new Web3(window.celo)
      //   Use web3 object to create new kit instance - save to global variable
      //   Now the functionality of the connected kit can interact with Celo
      kit = newKitFromWeb3(web3)

      //   Access the account of the user - return an array of addresses of the connected user.  In the case of the CeloExtensionWallet you receive one address which you can make the kit's default user - can use globally
      const accounts = await kit.web3.eth.getAccounts()
      kit.defaultAccount = accounts[0]

      //   Once user connects wallet, create an instance of the marketplace contract so you can interact with it
      //   Assign global contract variable a new kit.web3.eth.Contract object
      // Pass the ABI and the address of the contract - will convert function calls into RPC - now can interact with the smart contract as if it were a Javascript object
      contract = new kit.web3.eth.Contract(marketplaceAbi, MPContractAddress)
    } catch (error) {
      // If catch an error notify user they must approve the dialogue box
      notification("⚠️ ${error}")
    }
  } else {
    // 'window.celo' object does not exist, so notify user to install wallet
    notification("⚠️ Please install the CeloExtensionWallet")
  }
}

// Access and display the user's cUSD account balance
const getBalance = async function () {
  // Use kit method to get the balance of the account
  const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
  //   Generate a readable cUSD balance - shift comma 18 places to the left and display only two decimal places
  const cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
  document.querySelector("#balance").textContent = cUSDBalance
}

// Once you have an instance of the contract to interact with can call functions
const getProducts = async function () {
  // Check how many products are stored in the contract
  // use contract.methods to call contract function and assign it's value
  const _productsLength = await contract.methods.getProductsLength().call()
  const _products = []

  for (let i = 0; i < _productsLength; i++) {
    // For each product create a promise in which call the contract's readProduct function to get product data
    let _product = new Promise(async (resolve, reject) => {
      let p = await contract.methods.readProduct(i).call()
      //   Resolve the promise with the product data
      // Price needs to be a bigNumber object so you can make correct payments
      resolve({
        index: i,
        owner: p[0],
        name: p[1],
        image: p[2],
        description: p[3],
        location: p[4],
        price: new BigNumber(p[5]),
        sold: p[6],
      })
    })
    _products.push(_product)
  }
  //   Once all promises in this asynchronous operation are fulfilled, render the products array
  products = await Promise.all(_products)
  renderProducts()
}

// Display products
function renderProducts() {
  document.getElementById("marketplace").innerHTML = ""
  products.forEach((_product) => {
    const newDiv = document.createElement("div")
    newDiv.className = "col-md-4"
    newDiv.innerHTML = productTemplate(_product)
    document.getElementById("marketplace").appendChild(newDiv)
  })
}

// Create the HTML of each product
function productTemplate(_product) {
  return `
    <div class="card mb-4">
        <img class="card-img-top" src="${_product.image}" alt="...">

        <div class="position-absolute top-0 end-0 bg-warning mt-4 px-2 py-1 rounded-start">
        ${_product.sold} Sold
        </div>

        <div class="card-body text-left p-4 position-relative">
            <div class="translate-middle-y position-absolute top-0">
            ${identiconTemplate(_product.owner)}
            </div>

            <h2 class="card-title fs-4 fw-bold mt-2">${_product.name}</h2>

            <p class="card-text mb-4" style="min-height: 82px">
            ${_product.description}             
            </p>

            <p class="card-text mt-4">
                <i class="bi bi-geo-alt-fill"></i>
                <span>${_product.location}</span>
            </p>

            <div class="d-grid gap-2">
                <a class="btn btn-lg btn-outline-dark buyBtn fs-6 p-3" id=${
                  _product.index
                }>
                Buy for ${_product.price
                  // Dealing with BigNumbers so need to shift the price again
                  .shiftedBy(-ERC20_DECIMALS)
                  .toFixed(2)} cUSD
                </a>
            </div>
        </div>
    </div>
    `
}

// Create the identicon
function identiconTemplate(_address) {
  // takes an address as a parameter then creates an icon object through the blockies library
  //  Returns a round image of the icon and a link to the address transactions in the blockchain explorer
  const icon = blockies
    .create({
      seed: _address,
      size: 8,
      scale: 16,
    })
    .toDataURL()

  return `
        <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
            <a href="https://alfajores-blockscout.celo-testnet.org/address/${_address}/transactions"
            target="_blank">
            <img src="${icon}" width="48" alt="${_address}">
            </a>
        </div>
    `
}

// Notification functions
function notification(_text) {
  // Displays alert message in the alert class element
  document.querySelector(".alert").style.display = "block"
  document.querySelector("#notification").textContent = _text
}

function notificationOff() {
  document.querySelector(".alert").style.display = "none"
}

// Event handlers
window.addEventListener("load", async () => {
  // Once the DApp is loaded call notification, display balance, render products and then disable notification
  notification("⌛ Loading...")
  await connectCeloWallet()
  await getBalance()
  await getProducts()
  //   renderProducts()
  notificationOff()
})

// Add a new product from modal input form
document
  .querySelector("#newProductBtn")
  .addEventListener("click", async (e) => {
    // In params array store all parameters from the form
    // Note - price value - need to create a bigNumber and convert in a way that the contract can understand
    const params = [
      document.getElementById("newProductName").value,
      document.getElementById("newImgUrl").value,
      document.getElementById("newProductDescription").value,
      document.getElementById("newLocation").value,
      new BigNumber(document.getElementById("newPrice").value)
        .shiftedBy(ERC20_DECIMALS)
        .toString(),
    ]
    // Show notification that new product being added
    notification(`⌛ Adding "${params[0]}"`)

    try {
      const result = await contract.methods
        // use writeProduct with saved params
        .writeProduct(...params)
        // Since sending a transaction and executing method - need send method
        .send({ from: kit.defaultAccount })
    } catch (error) {
      notification(`⚠️ ${error}`)
    }
    notification(`🎉 You successfully added "${params[0]}"`)
    getProducts()
  })

// User buys a product
document.querySelector("#marketplace").addEventListener("click", (e) => {
  if (e.target.className.includes("buyBtn")) {
    console.log(e.target.id)
    const index = e.target.id
    products[index].sold++
    notification(`🎉 You successfully bought "${products[index].name}"`)
    renderProducts()
  }
})

// Initial create new product form functionality
// document.querySelector("#newProductBtn").addEventListener("click", () => {
//   const _product = {
//     owner: "0x2EF48F32eB0AEB90778A2170a0558A941b72BFFb",
//     name: document.getElementById("newProductName").value,
//     image: document.getElementById("newImgUrl").value,
//     description: document.getElementById("newProductDescription").value,
//     location: document.getElementById("newLocation").value,
//     price: document.getElementById("newPrice").value,
//     sold: 0,
//     index: products.length,
//   }

//   products.push(_product)
//   notification(`🎉 You successfully added "${_product.name}"`)
//   renderProducts()
// })
