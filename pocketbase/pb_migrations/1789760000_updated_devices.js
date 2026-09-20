/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2153001328")

  // add field: rate_limit_per_min (max SMS/min per SIM; 0 or empty = unlimited)
  collection.fields.addAt(8, new Field({
    "help": "Max SMS per minute for this device/SIM. 0 or empty means unlimited.",
    "hidden": false,
    "id": "number4113018790",
    "max": null,
    "min": 0,
    "name": "rate_limit_per_min",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2153001328")

  // remove field
  collection.fields.removeById("number4113018790")

  return app.save(collection)
})
