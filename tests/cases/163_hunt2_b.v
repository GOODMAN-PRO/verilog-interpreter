module t;
  function automatic integer f(input integer n);
    reg [7:0] mem [0:1];
    begin
      mem[0] = n;
      if (n > 0) f = f(n-1); else f = 0;
      f = f + mem[0];
    end
  endfunction
  initial $display("%0d", f(3));
endmodule
