#node-red-contrib-fabric-composer
A set of nodes for interacting with Fabric Composer

*Note : These node will only work if you are running node red locally. It won't work if you are using node red on bluemix.*


##Fabric-Composer-Out
A node red output node that allows you to create or update assets or participants and submit transactions.

###Example Usage
This example uses the Car Auction Sample Network that can be obtained from [here](https://github.com/fabric-composer/sample-networks/tree/master/packages/carauction-network)

The Car Auction Sample, simulates a car auction. It has two kinds of participant. An Auctioneer, who is responsible for conducting the auction, and a member who can bid on cars in the auction.
In this example we will create a participant, the participant .

1. Deploy the Car Auction Sample Network using the playground or on the command line (If you don't know how to do this go [here](https://fabric-composer.github.io/))

2. Create a `fabric-composer-out node`

3. Enter the `connection profile name`, `business network identifier`, `participant Id`, and `participant password` on the `fabric-composer-out node`.

4. Use an inject node and set it to use `JSON` and enter the following JSON

```
{"$class": "org.acme.vehicle.auction.Member",   "balance": 1234,   "email": "Joe-Blogs@org.acme.com",   "firstName": "Joe",   "lastName": "Blogs" }
```

5. Using the playground or command line you should now be able to see the participant that has been created.

##Fabric-Composer-Mid
A node red mid flow node that allows you to get assets or participants from a registry.

###Example Usage
This example follows on from the above example. It will retrieve the participant that was created above.
 
 1. Create a `fabric-composer-mid node`
 
 2. Enter the `connection profile name`, `business network identifier`, `participant Id`, and `participant password` on the `fabric-composer-mid node`.
 
 3. Use an `inject node` and set it to use JSON and enter the following JSON
 
 ```
{"modelName" : "org.acme.vehicle.auction.Member", "id" : "Joe-Blogs@org.acme.com"}
```

4. Use a `debug node` to capture the output from the `fabric-composer-mid node`
