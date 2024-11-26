const mockI2cBus = {
  openSync: () => {
    return {
      writeByteSync: () => console.log("mock writeByteSync called"),
      readByteSync: () => console.log("mock readByteSync called"),
      writeI2cBlockSync: () => console.log("mock writeI2cBlockSync called"),
      
      readI2cBlockSync: (address, register, length, buffer) => {
        console.log(`mock readI2cBlockSync called for address ${address}, register ${register}, length ${length}`);
        
        // Simulate reading data into the buffer
        for (let i = 0; i < length; i++) {
          buffer[i] = Math.floor(Math.random() * 256); // Random byte values
        }

        // Return the number of bytes "read"
        return length;
      },
    };
  },
};

module.exports = mockI2cBus;
