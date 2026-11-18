module tb;
  reg [7:0] a, b, mem [0:1];
  integer index;
  initial begin
    a = 0;
    b = 7;
    mem[0] = 0;
    mem[1] = 0;
    index = 0;
    fork
      begin
        a = #3 b;
        $display("captured a=%0d b=%0d time=%0d", a, b, $time);
        #2 a = b;
        $display("delayed statement a=%0d time=%0d", a, $time);
      end
      begin
        #1 b = 9;
        #3 b = 11;
      end
    join
    fork
      begin mem[index] = #3 b; end
      begin #1 index = 1; b = 13; end
    join
    #1 $display("blocking index=%0d mem=%0d,%0d", index, mem[0], mem[1]);
    $finish;
  end
endmodule