`timescale 1ns/1ps
module encoder(input [7:0] request, output reg valid, output reg [2:0] index);
  always @* begin
    valid = 1;
    casez (request)
      8'b1???????: index = 7;
      8'b01??????: index = 6;
      8'b001?????: index = 5;
      8'b0001????: index = 4;
      8'b00001???: index = 3;
      8'b000001??: index = 2;
      8'b0000001?: index = 1;
      8'b00000001: index = 0;
      default: begin valid = 0; index = 0; end
    endcase
  end
endmodule
module tb;
  reg [7:0] request;
  wire valid;
  wire [2:0] index;
  integer i;
  encoder dut(request, valid, index);
  task show;
    begin #1; $display("request=%b valid=%b index=%0d", request, valid, index); end
  endtask
  initial begin
    request = 0; show;
    for (i = 0; i < 8; i = i + 1) begin request = 1 << i; show; end
    request = 8'h35; show; request = 8'hff; show;
    request = 8'b1xxxxxxx; show;
    request = 8'b0x000001; show;
    request = 8'b0000000z; show;
    $finish;
  end
endmodule
