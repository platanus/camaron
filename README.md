# Camaron

The official nodejs crabfarm client

## Installation

Use `npm`:

    npm install camaron --save

Then require it in your source

```js
var camaron = require('camaron');
```

## Usage

For now, camaron only supports crawlers deployed to grid.crabfarm.io.

To communicate with crawlers you use sessions. You can build a new session using `camaron.connect`:

```js
var session = camaron.connect('org/repo');
```

You can then change the crawler state using `navigate` (or `nav`):

```js
camaron
  .connect('org/repo')
  .navigate('front_page', { param1: 'hello' })
  .then(function(_session) {
    console.log(_session.data); // do something with extracted data
  });
```

Data extracted by last navigation is available at session's `data` property:

```js
_session.data.title
_session.data.price
```

You should always close the session when done!

```js
camaron
  .connect('org/repo')
  .navigate('front_page', { param1: 'hello' })
  .close();
```

All methods in a camaron session are chainable, you can insert your own logic between session changes using `then`, `rescue` and `ensure`:

```js
camaron
  .connect('org/repo')
  .navigate('front_page', { param1: 'hello' })
  .then(function() {
    // called on success
  }, function() {
    // optional, called on error
  })
  .rescue(function() {
    // called on error
  })
  .ensure(function() {
    // called always
  })
  .close();
```

You can also queue additional session changes inside chained logic:

```js
camaron
  .connect('org/repo')
  .navigate('front_page', { param1: 'hello' })
  .then(function(_session) {
    if(_session.data.success) {
      _session
        .navigate('orders_page')
        .then(function() {
          console.log('Received ' + _session.data.orders.length + ' orders');
        });
    }
  })
  .close();
```

## Contributing

1. Fork it ( https://github.com/platanus/camaron/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request
